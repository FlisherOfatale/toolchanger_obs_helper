"""
License:
    GPLv3

    Copyright (c) 2022 Sebastian Holzgreve

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
"""

from urllib import response
import websocket
import json

import sys
import time
import yaml
import logging
logging.basicConfig(level=logging.DEBUG)

sys.path.append('../')
from obswebsocket import obsws, requests  # noqa: E402
with open('config.yaml', 'r') as file:
    config = yaml.safe_load(file)

printer_ws_url = "ws://%s:%s/websocket?token=" % ( config['printer']['host'], str(config['printer']['moonracker_port']))
def on_close(printer_ws, close_status, close_msg):
  pass

def on_error(printer_ws, error):
  print("Websocket error: %s" % error)

def setCamera(cameraType):
  obs_websocket.call(requests.SetCurrentProgramScene(sceneName=camera.get(config['obs']['scene'][cameraType])))
              
def on_message(printer_ws, msg):
  response = json.loads(msg)
 
  if response['method'] == "notify_gcode_response":
    print(json.dumps(response, indent=3))  
    response_params_list = response.get("params")
    for response_log in response_params_list:
        if response_log.startswith("echo: Toolchange Starting"):
            setCamera("ToolChanging")
        elif response_log.startswith("echo: Toolchange Completed"):
            setCamera("Printing")
  #else:
  # print(json.dumps(response, indent=3))

def on_open(printer_ws):
  print("on_open()...")
  #Unsubscribe from any printer objects
  data = {
    "jsonrpc": "2.0",
    "method": "printer.objects.subscribe",
    "params": {
        "objects": {
        }
    },
    "id": 4654
  }

  #printer_ws.send(json.dumps(data))

printer_ws = websocket.WebSocketApp(url=printer_ws_url, on_close=on_close, on_error=on_error, on_message=on_message, on_open=on_open)

## OBS Websocket studd
obs_websocket = obsws(config['obs']['host'], config['obs']['port'], config['obs']['password'])
obs_websocket.connect()

printer_ws.run_forever()
