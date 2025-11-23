<?php
// CONFIGURATION
$EXPECTED_API_KEY = "__DEV_KEY__"; // Keep this secret
$ENABLE_LOGGING   = isset($_POST['IsLogging']) && $_POST['IsLogging'] === 'true';

// HELPER: Logging Function
function wh_log($msg) {
    global $ENABLE_LOGGING;
    if (!$ENABLE_LOGGING) return;

    $log_dir = $_SERVER['DOCUMENT_ROOT'] . "/log";
    
    // Create log directory if it doesn't exist (Permissions: 0755 is safer than 0777)
    if (!file_exists($log_dir)) {
        mkdir($log_dir, 0755, true);
    }

    $log_file = $log_dir . '/log_' . date('d-M-Y') . '.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($log_file, "[$timestamp] $msg" . PHP_EOL, FILE_APPEND);
}

// 1. SECURITY CHECK
$receivedKey = isset($_POST['ApiKey']) ? $_POST['ApiKey'] : '';

// Use strictly equals (===) to prevent the bypass vulnerability
if ($receivedKey !== $EXPECTED_API_KEY) {
    wh_log("| GE: Auth failed. Invalid Key.");
    http_response_code(403); // Forbidden
    echo json_encode(["status" => "error", "message" => "Invalid API Key"]);
    exit;
}

wh_log("| GE: Auth success.");

// 2. VALIDATE INPUTS
$requiredFields = ['PostPublishYear', 'PostPublishMonth', 'PostSlug', 'PostBody'];
foreach ($requiredFields as $field) {
    if (empty($_POST[$field])) {
        wh_log("| GE: Missing field: $field");
        http_response_code(400); // Bad Request
        echo json_encode(["status" => "error", "message" => "Missing field: $field"]);
        exit;
    }
}

// 3. SANITIZE INPUTS (Prevent Directory Traversal)
// We only allow numbers for Year/Month, and alphanumeric+dashes for Slugs.
// This prevents inputs like "../../windows/"
$pubYear  = preg_replace('/[^0-9]/', '', $_POST['PostPublishYear']);
$pubMonth = preg_replace('/[^0-9]/', '', $_POST['PostPublishMonth']);
$slug     = preg_replace('/[^a-zA-Z0-9-_]/', '', $_POST['PostSlug']);
$content  = $_POST['PostBody']; // Raw HTML allowed

wh_log("| GE: Processing $slug ($pubYear/$pubMonth)");

// 4. DEFINE PATHS
$fileName = $slug . ".html";
$fileDir  = "blog/" . $pubYear . "/" . $pubMonth;
$filePath = $fileDir . "/" . $fileName;

// 5. CREATE DIRECTORY
if (!file_exists($fileDir)) {
    wh_log("| GE: Creating directory $fileDir");
    if (!mkdir($fileDir, 0755, true)) {
        wh_log("| GE: Failed to create directory.");
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Server failed to create directory"]);
        exit;
    }
}

// 6. WRITE FILE
// file_put_contents is cleaner than fopen/fwrite/fclose
// We do NOT use htmlentities() so that the HTML tags render correctly in the browser.
if (file_put_contents($filePath, $content)) {
    wh_log("| GE: File write success: $filePath");
    http_response_code(200);
    echo json_encode([
        "status" => "success", 
        "path" => $filePath
    ]);
} else {
    wh_log("| GE: File write failed.");
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to write file"]);
}
?>