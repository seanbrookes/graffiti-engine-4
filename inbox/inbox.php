<?php
 function wh_log($isLogging, $log_msg) {
  if ($isLogging === 'true') {
    $log_filename = $_SERVER['DOCUMENT_ROOT']."/log";
    if (!file_exists($log_filename))
    {
        // create directory/folder uploads.
        mkdir($log_filename, 0777, true);
    }
    $log_file_data = $log_filename.'/log_' . date('d-M-Y') . '.log';
    file_put_contents($log_file_data, $log_msg . "\n", FILE_APPEND);  
  }
}
  // print out the received values in the browser
  // echo "Your api key: {$_POST['ApiKey']}<br />";
  // echo "Your publish year: {$_POST['PostPublishYear']}<br />";
  // echo "Your publish month: {$_POST['PostPublishMonth']}<br />";
  // echo "Your slug: {$_POST['PostSlug']}<br /><br />";
  // echo "Your post:<br />{$_POST['PostBody']}<br /><br />";

	$isLogging = isset($_POST['IsLogging']) ? $_POST['IsLogging'] : false;
	// $isLogging = true;
	$apiKey = isset($_POST['ApiKey']) ? $_POST['ApiKey'] : 'default';
	// call to function
  wh_log($isLogging, '| GE: inbox start lifecycle');
	if ($apiKey = "__DEV_KEY__"){
    wh_log($isLogging, '| GE: inbox correct apiKey ' . $apiKey);
    $pubYear = $_POST['PostPublishYear'];
    wh_log($isLogging, '| GE: inbox PostPublishYear ' . $pubYear);
    $pubMonth = $_POST['PostPublishMonth'];
    wh_log($isLogging, '| GE: inbox PostPublishMonth ' . $pubMonth);
    $pubFileName = $_POST['PostSlug'] . ".html";
    wh_log($isLogging, '| GE: inbox PostSlug ' . $pubFileName);

    $filedir = "blog/" . $pubYear . "/" . $pubMonth;
    $filepath = $filedir . "/" . $pubFileName;

    // echo $filepath;
    wh_log($isLogging, '| GE: inbox filepath ' . $filepath);

  $bIsFolderAvailable = false;

  if(!file_exists($filedir)){
    wh_log($isLogging, '| GE: inbox this file does not already exist ');

    if(mkdir($filedir,0755,true)){
      wh_log($isLogging, '| GE: inbox create folder success ' . $filedir);
      $bIsFolderAvailable = true;

    }
    else{
      wh_log($isLogging, '| GE: inbox PROBLEM the folder was not created ' .$filedir);
      echo "fail the directory $filedir was not created.";
    }
  }
  else{
    $bIsFolderAvailable = true;
  }
  if ($bIsFolderAvailable){
    wh_log($isLogging, '| GE: inbox $bIsFolderAvailable ' . $bIsFolderAvailable);
    $myFile = $filepath;
    wh_log($isLogging, '| GE: inbox $myFile ' . $myFile);
    $fh = fopen($myFile, 'w') or die("can't open file");
    $stringData = htmlentities($_POST['PostBody']);
    wh_log($isLogging, '| GE: inbox fwrite PRE');
    if (fwrite($fh, $stringData)) {
      wh_log($isLogging, '| GE: inbox fwrite POST');
      fclose($fh);
      echo "success";
      http_response_code(200);
    }
    else{
      wh_log($isLogging, '| GE: inbox fwrite failed');
      fclose($fh);
      echo "fail";
      http_response_code(500);
    }

  }
  else{
    wh_log($isLogging, '| GE: inbox PROBLEM the folder was not available ');
    http_response_code(500);
    echo 'fail';
  }
 }
?>
