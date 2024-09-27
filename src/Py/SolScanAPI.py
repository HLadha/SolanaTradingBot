import json
import requests

def getSPLTransfers(address):
  headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ja;q=0.7',
    'If-None-Match': '',
    'Origin': 'https://solscan.io',
    'Referer': 'https://solscan.io/',
    'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': 'macOS',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Sol-Aut': 'LtwB9dls0fK=BqpE0SwU-cq=8AdeLBkPAveVFqYj',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }

  url = f"https://api.solscan.io/v2/account/transaction?address={address}&limit=10"
  response = requests.get(url, headers=headers, data={})
  return response

def getTransaction(txId):
  headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ja;q=0.7',
    'If-None-Match': 'W/"67bb-QlnMM0gSshw/4Jf+UnFlP6JGljQ"',
    'Origin': 'https://solscan.io',
    'Referer': 'https://solscan.io/',
    'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': 'macOS',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Sol-Aut': 'LtwB9dls0fK=BqpE0SwU-cq=8AdeLBkPAveVFqYj',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }
  url = f"https://api.solscan.io/v2/transaction-v2?tx={txId}"
  response = requests.get(url, headers=headers, data={})
  return response
