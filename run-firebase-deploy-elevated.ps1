Set-Location "C:\Users\argos\Documents\stacktrackpro\web"

$firebase = "C:\Users\argos\AppData\Roaming\npm\firebase.cmd"
$log = "C:\Users\argos\Documents\stacktrackpro\web\deploy-output.log"

if (!(Test-Path $firebase)) {
	Write-Error "Firebase CLI not found at $firebase"
	exit 1
}

Write-Host "Using Firebase CLI at: $firebase"
Start-Transcript -Path $log -Force | Out-Null
& $firebase deploy --only hosting --debug --force --non-interactive
$exitCode = $LASTEXITCODE
Stop-Transcript | Out-Null
exit $exitCode
