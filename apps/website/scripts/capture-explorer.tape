Output public/images/explorer-welcome.gif
Set Width 1400
Set Height 980
Set FontSize 20
Set Padding 18
Set WaitTimeout 45s

Hide
Type "cd /home/gabe/Code/@initlabs/vibekit && env -u VIBEKIT_AGENT_MODEL -u VIBEKIT_AGENT_PROVIDER -u VIBEKIT_AGENT_BASE_URL -u VIBEKIT_AGENT_API_KEY XDG_CONFIG_HOME=/tmp/vibekit-website-capture VIBEKIT_MOTION=off bun run apps/tui/src/index.tsx"
Enter
Wait+Screen /paste an id/
Show
Sleep 1s
Screenshot public/images/explorer-welcome.png
Sleep 1s
Ctrl+C
