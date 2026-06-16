<?php
/**
 * PHP-Python Bridge - Spouští Python skripty bez použití shell
 * 
 * Tento bridge používá proc_open() místo exec() aby obešel problém
 * se špatným shell interpreterem na serveru.
 */

/**
 * Spustí Python skript s argumenty
 * 
 * @param string $pythonPath Absolutní cesta k Python executable (např. /usr/bin/python3)
 * @param string $scriptPath Absolutní cesta k Python skriptu
 * @param array $args Pole argumentů pro skript
 * @param string|null $stdinData Data pro STDIN (volitelné)
 * @return array ['success' => bool, 'stdout' => string, 'stderr' => string, 'exit_code' => int]
 */
function runPythonScript(string $pythonPath, string $scriptPath, array $args = [], ?string $stdinData = null): array
{
    // NOVÝ PŘÍSTUP: Použijeme array místo string pro proc_open (bypass shell úplně)
    // Pokud to nefunguje, zkusíme exec s output buffering
    
    // Metoda 1: Pokus o array command (nejbezpečnější)
    $cmdArray = [$pythonPath, $scriptPath];
    foreach ($args as $arg) {
        $cmdArray[] = $arg;
    }
    
    $descriptors = [
        0 => ['pipe', 'r'],  // STDIN
        1 => ['pipe', 'w'],  // STDOUT
        2 => ['pipe', 'w']   // STDERR
    ];
    
    // Pokus 1: Array command (bypass_shell implicitně)
    $process = @proc_open($cmdArray, $descriptors, $pipes, null, null);
    
    // Pokud array nefunguje, fallback na exec()
    if (!is_resource($process)) {
        // Metoda 2: exec() s output capture
        $cmd = $pythonPath;
        foreach (array_merge([$scriptPath], $args) as $arg) {
            $cmd .= ' ' . escapeshellarg($arg);
        }
        
        $output = [];
        $exitCode = 0;
        exec($cmd . ' 2>&1', $output, $exitCode);
        
        return [
            'success' => ($exitCode === 0),
            'stdout' => implode("\n", $output),
            'stderr' => '',
            'exit_code' => $exitCode
        ];
    }
    
    // Array command fungoval - použijeme proc_open
    if ($stdinData !== null) {
        fwrite($pipes[0], $stdinData);
    }
    fclose($pipes[0]);
    
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    
    $exitCode = proc_close($process);
    
    return [
        'success' => ($exitCode === 0),
        'stdout' => $stdout,
        'stderr' => $stderr,
        'exit_code' => $exitCode
    ];
}

/**
 * Spustí Python skript s argumenty ve stylu CLI (--arg value)
 * 
 * @param string $pythonPath Absolutní cesta k Python executable
 * @param string $scriptPath Absolutní cesta k Python skriptu
 * @param array $cliArgs Asociativní pole argumentů ['--arg' => 'value']
 * @param string|null $stdinData Data pro STDIN (volitelné)
 * @return array ['success' => bool, 'stdout' => string, 'stderr' => string, 'exit_code' => int]
 */
function runPythonScriptWithCLI(string $pythonPath, string $scriptPath, array $cliArgs = [], ?string $stdinData = null): array
{
    $args = [];
    foreach ($cliArgs as $key => $value) {
        $args[] = $key;
        if ($value !== null && $value !== true) {
            $args[] = $value;
        }
    }
    
    return runPythonScript($pythonPath, $scriptPath, $args, $stdinData);
}

/**
 * Test funkce - zkusí spustit Python a zjistit verzi
 */
function testPythonBridge(): array
{
    $pythonPath = '/usr/bin/python3';
    
    // Spustíme bez shellu: python -c "..."
    $result = runPythonScript($pythonPath, '-c', ['import sys; print(sys.version)']);
    
    return [
        'python_path' => $pythonPath,
        'working' => $result['success'],
        'version' => trim($result['stdout']),
        'error' => $result['stderr']
    ];
}
?>
