# Le a ultima resposta do Claude em voz alta usando o Windows Speech (SAPI).
# Disparado pelo hook "Stop" do Claude Code; recebe o payload do evento via stdin.
$ErrorActionPreference = 'Stop'

try {
    $stdin = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($stdin)) { exit 0 }
    $hookInput = $stdin | ConvertFrom-Json
    $transcriptPath = $hookInput.transcript_path
    if (-not $transcriptPath -or -not (Test-Path -LiteralPath $transcriptPath)) { exit 0 }

    $lastText = $null
    Get-Content -LiteralPath $transcriptPath | ForEach-Object {
        $line = $_
        if ([string]::IsNullOrWhiteSpace($line)) { return }
        try {
            $entry = $line | ConvertFrom-Json
        } catch {
            return
        }
        if ($entry.type -eq 'assistant' -and $entry.message -and $entry.message.content) {
            $textParts = @()
            foreach ($block in $entry.message.content) {
                if ($block.type -eq 'text' -and $block.text) {
                    $textParts += $block.text
                }
            }
            if ($textParts.Count -gt 0) {
                $lastText = ($textParts -join "`n")
            }
        }
    }

    if (-not $lastText) { exit 0 }

    # Remove blocos de codigo cercados por ```
    $clean = [regex]::Replace($lastText, '```[\s\S]*?```', ' trecho de codigo omitido. ')
    # Remove code inline, mantendo o conteudo
    $clean = [regex]::Replace($clean, '`([^`]*)`', '$1')
    # Remove marcacao markdown simples
    $clean = [regex]::Replace($clean, '[\*_#>]', '')
    $clean = $clean.Trim()

    if (-not $clean) { exit 0 }

    $truncated = $false
    $paragraphBreak = $clean.IndexOf("`n`n")
    if ($paragraphBreak -gt 0 -and $paragraphBreak -lt 500) {
        $clean = $clean.Substring(0, $paragraphBreak)
        $truncated = $true
    } elseif ($clean.Length -gt 500) {
        $clean = $clean.Substring(0, 500)
        $truncated = $true
    }

    if ($truncated) {
        $clean = $clean + '. Resposta completa esta no texto.'
    }

    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $ptVoice = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'pt-*' -and $_.VoiceInfo.Gender -eq 'Female' } | Select-Object -First 1
    if (-not $ptVoice) {
        $ptVoice = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'pt-*' } | Select-Object -First 1
    }
    if ($ptVoice) {
        $synth.SelectVoice($ptVoice.VoiceInfo.Name)
    }
    $synth.Rate = 2

    # SSML com pitch mais agudo para soar mais jovem (voz sintetica do Windows nao tem variante "jovem" nativa)
    $escaped = $clean.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;').Replace("'", '&apos;')
    $voiceName = $ptVoice.VoiceInfo.Name
    $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><voice name='$voiceName'><prosody pitch='+20%'>$escaped</prosody></voice></speak>"
    $synth.SpeakSsml($ssml)
} catch {
    exit 0
}
