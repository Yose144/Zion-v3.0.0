<?php
/**
 * ZION eShop - Stripe Webhook
 * Přijímá události od Stripe (potvrzení platby, refundy, atd.)
 * 
 * Nastavení: Stripe Dashboard → Developers → Webhooks
 * Endpoint URL: https://newearth.cz/V2/api/stripe-webhook.php
 * Events: checkout.session.completed, payment_intent.succeeded
 */

// config.php může být mimo git / nasazovaný separátně
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}
require_once __DIR__ . '/wallet-lib.php';

// Stripe posílá raw JSON
$payload = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

// Ověření webhook podpisu (pokud je nakonfigurován)
if (defined('STRIPE_WEBHOOK_SECRET') && STRIPE_WEBHOOK_SECRET !== 'whsec_XXXXXXXXXXXXXXXXXXXXXXXX') {
    $signature = verifyStripeSignature($payload, $sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!$signature) {
        http_response_code(400);
        error_log('Stripe webhook: Invalid signature');
        exit('Invalid signature');
    }
}

$event = json_decode($payload, true);

if (!$event || !isset($event['type'])) {
    http_response_code(400);
    exit('Invalid payload');
}

// Logování události
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
file_put_contents(
    $logDir . '/stripe-webhooks.log',
    date('Y-m-d H:i:s') . ' - ' . $event['type'] . ' - ' . ($event['data']['object']['id'] ?? 'N/A') . "\n",
    FILE_APPEND
);

// Zpracování události
switch ($event['type']) {
    case 'checkout.session.completed':
        handleCheckoutCompleted($event['data']['object']);
        // Forward presale sessions to Python FastAPI (optional hybrid sync)
        forwardToPythonIfPresale($event);
        break;
        
    case 'payment_intent.succeeded':
        handlePaymentSucceeded($event['data']['object']);
        break;
        
    case 'payment_intent.payment_failed':
        handlePaymentFailed($event['data']['object']);
        break;
        
    default:
        // Ignorovat ostatní události
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);

// ===== HANDLER FUNKCE =====

function handleCheckoutCompleted(array $session): void
{
    $orderId = $session['metadata']['order_id'] ?? null;
    $isPresaleMeta = isset($session['metadata']['presale']) && ($session['metadata']['presale'] === 'true' || $session['metadata']['presale'] === true);
    $paymentStatus = $session['payment_status'] ?? '';
    $amountTotal = ($session['amount_total'] ?? 0) / 100; // Z haléřů na Kč
    
    if (!$orderId) {
        error_log('Stripe webhook: Missing order_id in metadata');
        return;
    }
    
    // Načíst objednávku (e-shop orders/ nebo presale-orders/)
    $orderFile = __DIR__ . '/../orders/' . $orderId . '.json';
    $presaleFile = __DIR__ . '/../presale-orders/' . $orderId . '.json';
    $isPresaleFile = false;

    if (!file_exists($orderFile) && file_exists($presaleFile)) {
        $orderFile = $presaleFile;
        $isPresaleFile = true;
    }

    if (!file_exists($orderFile)) {
        error_log('Stripe webhook: Order file not found: ' . $orderId);
        return;
    }
    
    $order = json_decode(file_get_contents($orderFile), true);
    if (!$order) {
        error_log('Stripe webhook: Invalid order JSON: ' . $orderId);
        return;
    }
    
    $isPresaleOrder = $isPresaleMeta || $isPresaleFile || (($order['type'] ?? '') === 'presale');

    // Aktualizovat stav objednávky
    if ($isPresaleOrder) {
        if (!isset($order['payment']) || !is_array($order['payment'])) {
            $order['payment'] = [];
        }
        $order['payment']['status'] = $paymentStatus === 'paid' ? 'paid' : 'pending';
        $order['payment']['method'] = $order['payment']['method'] ?? 'card';
        $order['status'] = $paymentStatus === 'paid' ? 'paid' : ($order['status'] ?? 'pending');
        $order['stripe'] = array_merge((array)($order['stripe'] ?? []), [
            'sessionId' => $session['id'] ?? null,
            'paymentIntent' => $session['payment_intent'] ?? null,
            'paymentStatus' => $paymentStatus,
            'amountTotal' => $amountTotal,
        ]);
        $order['paidAt'] = $paymentStatus === 'paid' ? date(DATE_ATOM) : ($order['paidAt'] ?? null);
        $order['updatedAt'] = date(DATE_ATOM);
    } else {
        $order['paymentStatus'] = $paymentStatus === 'paid' ? 'paid' : 'pending';
        $order['stripeSessionId'] = $session['id'];
        $order['stripePaymentIntent'] = $session['payment_intent'] ?? null;
        $order['paidAt'] = $paymentStatus === 'paid' ? date(DATE_ATOM) : null;
        $order['updatedAt'] = date(DATE_ATOM);
    }
    
    // Uložit aktualizovanou objednávku
    file_put_contents($orderFile, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // Aktualizovat ledger záznam (pokud existuje) - e-shop flow
    if (!$isPresaleOrder && $paymentStatus === 'paid' && !empty($order['zion']['ledger']['id'])) {
        zion_wallet_update_ledger_entry($order['zion']['ledger']['id'], [
            'note' => 'Platba kartou potvrzena - Stripe',
            'status' => 'queued' // Připraveno k odeslání tokenů
        ]);
    }
    
    // Odeslat potvrzovací e-mail (volitelné) - zatím pouze e-shop
    if (!$isPresaleOrder && $paymentStatus === 'paid') {
        sendPaymentConfirmationEmail($order);
    }
    
    error_log('Stripe webhook: Order ' . $orderId . ' updated - status: ' . $paymentStatus);
}

/**
 * Pokud metadata obsahují presale flag, přepošle webhook payload na Python API
 */
function forwardToPythonIfPresale(array $event): void
{
    $obj = $event['data']['object'] ?? [];
    $metadata = $obj['metadata'] ?? [];
    $isPresale = isset($metadata['presale']) && ($metadata['presale'] === 'true' || $metadata['presale'] === true);
    
    // Konfigurace cílového URL
    $pythonUrl = defined('PYTHON_PRESALE_WEBHOOK_URL') && PYTHON_PRESALE_WEBHOOK_URL
        ? PYTHON_PRESALE_WEBHOOK_URL
        : 'http://127.0.0.1:8000/presale/webhook/stripe';
    
    if ($isPresale) {
        $payload = json_encode($event);
        $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
        
        $ch = curl_init($pythonUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Forwarded-Signature: ' . $sigHeader
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            error_log('Stripe webhook forward failed (HTTP ' . $httpCode . '): ' . ($response ?: 'no response'));
        } else {
            error_log('Stripe webhook forwarded to Python presale API successfully');
        }
    }
}

function handlePaymentSucceeded(array $paymentIntent): void
{
    // Můžete přidat další logiku pro payment_intent.succeeded
    error_log('Stripe webhook: Payment succeeded - ' . $paymentIntent['id']);
}

function handlePaymentFailed(array $paymentIntent): void
{
    error_log('Stripe webhook: Payment failed - ' . $paymentIntent['id']);
    
    // Můžete odeslat e-mail zákazníkovi o neúspěšné platbě
}

function sendPaymentConfirmationEmail(array $order): void
{
    $customerEmail = $order['customer']['email'] ?? null;
    if (!$customerEmail) {
        return;
    }
    
    $subject = "Platba přijata - objednávka #{$order['orderId']}";
    $body = <<<EMAIL
Dobrý den,

Vaše platba kartou za objednávku #{$order['orderId']} byla úspěšně přijata.

Celková částka: {$order['total']} Kč

Vaše zboží bude co nejdříve odesláno.

S pozdravem,
Tým ZION Terra Nova
EMAIL;

    $headers = "From: ZION eShop <eshop@newearth.cz>\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    
    mail($customerEmail, $subject, $body, $headers);
}

function verifyStripeSignature(string $payload, string $sigHeader, string $secret): bool
{
    if (empty($sigHeader)) {
        return false;
    }
    
    // Parsovat Stripe signature header
    $parts = [];
    foreach (explode(',', $sigHeader) as $item) {
        $pair = explode('=', $item, 2);
        if (count($pair) === 2) {
            $parts[$pair[0]] = $pair[1];
        }
    }
    
    $timestamp = $parts['t'] ?? '';
    $signature = $parts['v1'] ?? '';
    
    if (!$timestamp || !$signature) {
        return false;
    }
    
    // Ověřit timestamp (max 5 minut starý)
    if (abs(time() - (int)$timestamp) > 300) {
        return false;
    }
    
    // Vypočítat očekávaný podpis
    $signedPayload = $timestamp . '.' . $payload;
    $expectedSignature = hash_hmac('sha256', $signedPayload, $secret);
    
    return hash_equals($expectedSignature, $signature);
}
