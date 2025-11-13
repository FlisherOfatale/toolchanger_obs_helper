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

#from urllib import response
import websocket
import sys
import json
import yaml
import logging
import signal

from obswebsocket import obsws, requests

logging.basicConfig(level=logging.DEBUG)

from obswebsocket import obsws, requests  # noqa: E402

# Global variables
obs_websocket = None
config = None

def on_close(ws, close_status, close_msg):
    pass

def on_error(ws, error):
    logging.error("Websocket error: %s", error)
    # Implement retry logic here

def setCamera(cameraType):
    try:
        obs_websocket.call(requests.SetCurrentProgramScene(sceneName=config['obs']['scene'][cameraType]))
    except Exception as e:
        logging.error("Error setting camera scene: %s", e)

def on_message(ws, msg):
  try:
    response = json.loads(msg)
    # Handle specific message types
    if response['method'] == "notify_gcode_response":
      # ... existing logic for handling tool change messages ...
      logging.debug(json.dumps(response, indent=3))
      response_params_list = response.get("params")
      for response_log in response_params_list:
        if response_log.startswith("echo: Toolchange Starting"):
          setCamera("ToolChanging")
        elif response_log.startswith("echo: Toolchange Completed"):
          setCamera("Printing")
    # Add logic for handling other message types as needed
  except Exception as e:
    logging.error("Error processing message: %s", e)

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

def connect_obs(host, port, password):
    obs_ws = obsws(host, port, password)
    try:
        obs_ws.connect()
        return obs_ws
    except Exception as e:
        logging.error("Error connecting to OBS websocket: %s", e)
        sys.exit(1)

# Handle keyboard interrupt (Ctrl+C)
def handle_interrupt(sig, frame):
    logging.info("Exiting...")
    printer_ws.close()
    obs_websocket.disconnect()
    sys.exit(0)

def main():
    global obs_websocket, config
    # Handle configuration file errors
    try:
        with open('config.yaml', 'r') as file:
            config = yaml.safe_load(file)
    except FileNotFoundError:
        logging.error("Error: Configuration file 'config.yaml' not found.")
        sys.exit(1)
    except yaml.YAMLError as e:
        logging.error("Error: Failed to parse configuration file: %s", e)
        sys.exit(1)
    logging.basicConfig(level=config['software']['debug_level'])
    # Connect to OBS websocket
    obs_websocket = connect_obs(config['obs']['host'], config['obs']['port'], config['obs']['password'])

    printer_ws_url = "ws://%s:%s/websocket?token=" % (config['printer']['host'], str(config['printer']['moonracker_port']))
    printer_ws = websocket.WebSocketApp(url=printer_ws_url, on_close=on_close, on_error=on_error, on_message=on_message, on_open=on_open)
    printer_ws.run_forever()

main()