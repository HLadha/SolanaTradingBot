from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
def getDocuments(query):
    client = MongoClient('mongodb://localhost:27017/')

    # Select the database
    db = client['main']

    # Select the collection
    collection = db['liquidityEnabled']

    # Find documents based on the query
    documents = collection.find(query)

    return documents

def updateDocument(collection_id, update_fields):
    client = MongoClient('mongodb://localhost:27017/')

    # Select the database
    db = client['main']
    collection = db['liquidityEnabled']

    # Convert the collection_id to an ObjectId
    collection_id = ObjectId(collection_id)

    # Create the update query
    update_query = {"$set": update_fields}

    # Update the document
    result = collection.update_one({"_id": collection_id}, update_query)

    return result.modified_count  # returns the number of documents modified


