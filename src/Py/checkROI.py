import pytz
from mongoFuncs import *
from SolScanAPI import *
from BirdEyeAPI import *
import json
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

def checkROI(document, timestamp, key):
    coin = document['coin']
    price_at_hour = getPrice(coin, timestamp)
    try:
        BPrice = document['BPrice']
        if BPrice == 0:
            BPrice = getPrice(coin, document['burnTime'].timestamp())
    except:
        BPrice = getPrice(coin, document['burnTime'].timestamp())

    try:
        roi = (price_at_hour - BPrice) / BPrice
    except:
        roi = -1
    try:
        if roi > 2:
            success = True
        else:
            success = False
    except:
        success = False
    updateDocument(document['_id'], {key: roi, key + '_success': success})

def process_document(document):
    if document['datetime'].timestamp() < (datetime.now(tz=pytz.utc).timestamp() - 86400):
        if 'roi' not in document:
            print(document['coin'])
            for i in range(2, 25, 2):
                timestamp = document['datetime'].timestamp() + (i * 3600)
                checkROI(document, timestamp, 'roi' + str(i))

def checkROIs():
    documentsToProcess = getDocuments({"checked": True, "burned": True, "roi2":{"$exists": False}})
    with ThreadPoolExecutor() as executor:
        executor.map(process_document, documentsToProcess)


'''def checkROIs():
    documentsToProcess = getDocuments({"checked": True, "burned": True})
    for document in documentsToProcess:
        if document['datetime'].timestamp() < (datetime.now(tz=pytz.utc).timestamp() - 86400):
            if 'roi' not in document:
                print(document['coin'])
                for i in range(2, 25, 2):
                    timestamp = document['datetime'].timestamp() + (i * 3600)
                    checkROI(document, timestamp, 'roi' + str(i))'''
checkROIs()
