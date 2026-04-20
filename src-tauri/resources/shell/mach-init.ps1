# Mach Terminal shell hook — OSC 7 cwd for status strip / restart (managed by Mach; do not edit).
if ($env:MACH_TERMINAL_SKIP_INIT -eq '1') {
  return
}

function __machEmitOsc7([string] $Path) {
  $b = [UriBuilder]::new()
  $b.Scheme = 'file'
  $b.Path = $Path
  [Console]::Out.Write([char]27 + ']7;' + $b.Uri.AbsoluteUri + [char]7)
}

$ExecutionContext.InvokeCommand.LocationChangedAction = {
  param($CommandOrigin, $LocationChangedArgs)
  __machEmitOsc7 $LocationChangedArgs.NewPath.ProviderPath
}

__machEmitOsc7 $PWD.ProviderPath
