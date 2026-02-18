<?php

class PHP_Email_Form {
  public $to = '';
  public $from_name = '';
  public $from_email = '';
  public $subject = '';
  public $smtp = array();
  private $messages = array();

  public function add_message($message, $label, $priority = 0) {
    $this->messages[] = array(
      'message' => $message,
      'label' => $label,
      'priority' => $priority
    );
  }

  public function send() {
    $headers = "From: " . $this->from_name . " <" . $this->from_email . ">\r\n";
    $headers .= "Reply-To: " . $this->from_email . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

    $body = "<html><body>";
    foreach ($this->messages as $msg) {
      $body .= "<strong>" . $msg['label'] . ":</strong> " . nl2br(htmlspecialchars($msg['message'])) . "<br>";
    }
    $body .= "</body></html>";

    if (mail($this->to, $this->subject, $body, $headers)) {
      return json_encode(array('message' => 'Email sent successfully!'));
    } else {
      return json_encode(array('message' => 'Failed to send email.'));
    }
  }
}

?>
