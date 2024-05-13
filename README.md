# toolchanger_obs_helper
Scene changer for OBS Studio, triggered on Printer Toolchange

The purpose of this python script is to trigger a scene change on OBS, when the printer initiate and complete a Toolchange.

# Disclaimer
This is a WIP, unpolished, with some bad practice, poor error handling, etc...
I ran it from my PC, should work from your printer directly but I would wait for a more polished version for that.

# Configuration
## Depedencies
Install the dependencies with `pip3 install -r requirements.txt`

## OBS and Printer Configuration
It's still ugly, but you need to change the configuration for your OBS and Moonracker API in the python script directly:
```python
obs_password = "aaabbbccc"
obs_host = "192.168.2.147"
obs_port = 4455
printer_ip = "192.168.2.115"
printer_api_port = 7125
```

And the name of your OBS scene here.  The scene is the value on the right:
```python
  camera = {
     "Toolchange" : "Toolchange",
     "Printing" : "Printing",
  }
```

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
## Notes
For this project, the ideal place to discuss the topic or suggest improvements would be on the [StealthChanger Discord](https://discord.com/invite/jJs73c6vSc).
I'm not planning a super fancy final tool, so if you want to take over the idea and make something big, i'll more than happy to have inspired someone.



## Dependencies and Credits
* https://github.com/Elektordi/obs-websocket-py/
* https://github.com/seho85/MoonrakerClientApiExamples/
