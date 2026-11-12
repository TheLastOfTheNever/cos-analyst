param(
    [switch]$Check
)

$ErrorActionPreference = "Stop"
$Port = 8000
$SiteUrl = "http://127.0.0.1:$Port/index.html"
$SiteRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$SessionId = [guid]::NewGuid().ToString("N")

if ($Check) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/__soc/session" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $response.Content -match '"sessionId":"[a-f0-9]{32}"') {
            exit 0
        }
    } catch {
        exit 1
    }

    exit 1
}

$RootPrefix = $SiteRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$ContentTypes = @{
    ".css" = "text/css; charset=utf-8"
    ".html" = "text/html; charset=utf-8"
    ".ico" = "image/x-icon"
    ".jpg" = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".js" = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".pdf" = "application/pdf"
    ".png" = "image/png"
    ".svg" = "image/svg+xml"
    ".txt" = "text/plain; charset=utf-8"
    ".webp" = "image/webp"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
}

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)

try {
    $Listener.Start()
    Write-Host "SOC Academy is hosted locally at $SiteUrl"
    Write-Host "Keep this window open while using the site. Press Ctrl+C to stop the server."

    while ($true) {
        $Client = $Listener.AcceptTcpClient()
        $Stream = $Client.GetStream()
        $Reader = $null

        try {
            $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $RequestLine = $Reader.ReadLine()
            $RequestParts = @()
            if ($RequestLine) {
                $RequestParts = $RequestLine -split "\s+"
            }

            while ($Reader.ReadLine()) { }

            $StatusCode = 200
            $Reason = "OK"
            $ContentType = "application/octet-stream"
            $Body = [byte[]]@()

            if ($RequestParts.Count -ge 2 -and $RequestParts[1] -eq "/__soc/session") {
                $SessionJson = '{"sessionId":"' + $SessionId + '"}'
                $Body = [System.Text.Encoding]::UTF8.GetBytes($SessionJson)
                $ContentType = "application/json; charset=utf-8"
            } elseif ($RequestParts.Count -lt 2 -or ($RequestParts[0] -ne "GET" -and $RequestParts[0] -ne "HEAD")) {
                $StatusCode = 405
                $Reason = "Method Not Allowed"
                $Body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                $ContentType = "text/plain; charset=utf-8"
            } else {
                $RequestPath = [System.Uri]::UnescapeDataString(($RequestParts[1] -split "\?", 2)[0]).TrimStart([char]"/")
                if ([string]::IsNullOrWhiteSpace($RequestPath)) {
                    $RequestPath = "index.html"
                }

                $RelativePath = $RequestPath.Replace([char]"/", [System.IO.Path]::DirectorySeparatorChar)
                $FilePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($SiteRoot, $RelativePath))
                if (-not $FilePath.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and $FilePath -ne $SiteRoot) {
                    $StatusCode = 403
                    $Reason = "Forbidden"
                    $Body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
                    $ContentType = "text/plain; charset=utf-8"
                } else {
                    if ([System.IO.Directory]::Exists($FilePath)) {
                        $FilePath = [System.IO.Path]::Combine($FilePath, "index.html")
                    }

                    if ([System.IO.File]::Exists($FilePath)) {
                        $Extension = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
                        if ($ContentTypes.ContainsKey($Extension)) {
                            $ContentType = $ContentTypes[$Extension]
                        }
                        if ($Extension -eq ".html") {
                            $Html = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
                            $SessionMeta = '<meta name="soc-session-id" content="{0}">' -f $SessionId
                            $Html = [System.Text.RegularExpressions.Regex]::Replace($Html, "</head>", "$SessionMeta`r`n</head>", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                            $Body = [System.Text.Encoding]::UTF8.GetBytes($Html)
                        } else {
                            $Body = [System.IO.File]::ReadAllBytes($FilePath)
                        }
                    } else {
                        $StatusCode = 404
                        $Reason = "Not Found"
                        $Body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                        $ContentType = "text/plain; charset=utf-8"
                    }
                }
            }

            $ContentLength = $Body.Length
            if ($RequestParts.Count -gt 0 -and $RequestParts[0] -eq "HEAD") {
                $Body = [byte[]]@()
            }

            $Headers = "HTTP/1.1 $StatusCode $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $ContentLength`r`nCache-Control: no-store`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n`r`n"
            $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Headers)
            $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
            if ($Body.Length -gt 0) {
                $Stream.Write($Body, 0, $Body.Length)
            }
            $Stream.Flush()
        } catch {
            Write-Host "Request failed: $($_.Exception.Message)"
        } finally {
            if ($Reader) { $Reader.Dispose() }
            $Stream.Dispose()
            $Client.Dispose()
        }
    }
} finally {
    $Listener.Stop()
}
