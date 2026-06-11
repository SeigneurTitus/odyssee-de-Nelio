$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Server started on http://localhost:8080/"

$basePath = "c:\Users\Titus\Documents\COURS\odyssee-de-nelio"
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".webp" = "image/webp"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $urlPath = $context.Request.Url.LocalPath
    if ($urlPath -eq "/") { $urlPath = "/index.html" }
    $filePath = Join-Path $basePath ($urlPath.Replace("/", "\"))

    if (Test-Path $filePath) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $ct = "application/octet-stream"
        if ($mimeTypes.ContainsKey($ext)) { $ct = $mimeTypes[$ext] }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $context.Response.ContentType = $ct
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $context.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found: $urlPath")
        $context.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $context.Response.Close()
}
