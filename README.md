# toolchanger_obs_helper
Scene changer for OBS Studio, triggered on Printer Toolchange

The purpose of this python script is to trigger a scene change on OBS, when the printer initiate and complete a Toolchange.

# Disclaimer
* This is a work in progress 
* This project is partially vibe coded with Github Copilot AI Agent
* Configuration, including your OBS Websocket password, will be strored in plain text inside your browser.  Note that there is no password by default.

Caveats:
* This expect the page to be loaded from an http server because by default, Moonracker isn't configured with HTTPS/WSS Support and browser enforce type match.
* I run it from VS Code live preview.  Will release something hosting on our Pi at some point in time.

# IMPORTANT CONFIGURATION CHANGE 

## Change to Klipper Macros (likely in your toolhead file)
In order to create a trigger, you will need to modify your T0 and other Tx macros.
The two `RESPOND` line will trigger the scene switch in OBS.
The M400 is required if you want the scene switch to happen AFTER the toolhead finished moving back to the printing position after the toolchange.

```yml
[gcode_macro T0]
variable_color: ""
gcode:
  RESPOND TYPE=echo MSG='Toolchange Starting' 
  SELECT_TOOL T=0
  M400
  RESPOND TYPE=echo MSG='Toolchange Completed'
```

You can youse whatever text you want, this text is configurable in the configuration option from my tool.  

### Todos:
* Add webserver for Pi and related script automation
* Add WSS support when using HTTPS
* improve documentation
* Add ability to have additional trigger + scene configurations.

## Notes
For this project, the ideal place to discuss the topic or suggest improvements would be on the [StealthChanger Discord](https://discord.com/invite/jJs73c6vSc).
