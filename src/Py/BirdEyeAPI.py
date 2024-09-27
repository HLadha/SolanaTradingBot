import requests
from datetime import datetime, timedelta

headers = {
    "accept": "application/json",
    "x-chain": "solana",
    "X-API-KEY": ""
}

def getPrice(token, timestamp):
    try:
        url = "https://public-api.birdeye.so/defi/history_price?"
        params = {
            "address": token,
            "address_type": 'token',
            "type": '1m',
            "time_from": int((datetime.fromtimestamp(timestamp) + timedelta(minutes=1)).timestamp()),
            "time_to": int((datetime.fromtimestamp(timestamp) + timedelta(minutes=2)).timestamp())
        }
        # Send the GET request
        response = requests.get(url, headers=headers, params=params)

        # Return the response data as a Python dictionary
        return response.json()['data']['items'][0]['value']
    except:
        return 0

def getCurrentPrice(token):
    try:
        url = "https://public-api.birdeye.so/defi/price?"
        params = {
            "address": token,
            "address_type": 'token'
        }
        # Send the GET request
        response = requests.get(url, headers=headers, params=params)

        # Return the response data as a Python dictionary
        return response.json()['data']['value']
    except:
        return 0
