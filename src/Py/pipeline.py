from datetime import datetime, timezone
import sys
import pandas as pd
import numpy as np
import xgboost as xgb
import matplotlib.pyplot as plt
from mongoFuncs import *
from sklearn.model_selection import train_test_split
from sklearn.metrics import balanced_accuracy_score, roc_auc_score, make_scorer
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import ConfusionMatrixDisplay
from sklearn.metrics import accuracy_score
import pickle
import ast

models = {}
for i in range(2, 25, 2):
    with open(f'xgboost_model{i}.pkl', 'rb') as file:
        models[i] = pickle.load(file)

with open('final_model.pkl', 'rb') as file:
    final_model = pickle.load(file)

def checkBuy(document):
    try:
        if document['LiquiditySOL'] is None:
            return [np.int64(0)]
        df = pd.DataFrame(document)
        df.drop('_id', axis=1, inplace=True)
        top_columns = df.filter(regex='^top', axis=1).columns
        top_columns = top_columns.drop('top20Total0', errors='ignore')
        top_columns = top_columns.drop('topHolders0', errors='ignore')
        df.drop(top_columns, axis=1, inplace=True)
        df.drop('coin', axis=1, inplace=True)
        df.drop('owner', axis=1, inplace=True)
        df.drop('SPLAddress', axis=1, inplace=True)
        df.drop('checked', axis=1, inplace=True)
        for col in df.columns:
            if df[col].dtype == np.bool_:
                df[col] = df[col].astype(int)
        df.drop('datetime', axis=1, inplace=True)
        df.drop('burnTime', axis=1, inplace=True)
        topHolders_df = df['topHolders0']
        topHolders_df = pd.DataFrame(topHolders_df)
        topHolders_df = topHolders_df.transpose()
        topHolders_df = topHolders_df.rename(columns=lambda x: 'topHolder_' + str(x))
        df = pd.concat([df[:], topHolders_df[:]], axis=1)
        df = df.drop('topHolders0', axis=1)
        expected_columns = ['LPBLaunch', 'freezeAuth', 'mintAuth', 'burned', 'top20Total0',
                            'fullBurn', 'BPrice', 'LPrice', 'LatestPrice', 'burnedPercentage',
                            'supply', 'LiquiditySOL', 'SPLLaunch', 'topHolder_0',
                            'topHolder_1', 'topHolder_2', 'topHolder_3', 'topHolder_4',
                            'topHolder_5', 'topHolder_6', 'topHolder_7', 'topHolder_8',
                            'topHolder_9', 'topHolder_10', 'topHolder_11', 'topHolder_12',
                            'topHolder_13', 'topHolder_14', 'topHolder_15', 'topHolder_16',
                            'topHolder_17', 'topHolder_18', 'topHolder_19']

        # Reorder the columns of df to match the order of expected_columns
        df = df[expected_columns]

        results = {}
        for i in range(2, 25, 2):
            dmatrix = xgb.DMatrix(df)
            results[i] = models[i].predict(dmatrix)

        df2 = pd.DataFrame(results)
        success = final_model.predict(df2)
        return success
    except Exception as e:
        print(document['coin'])
        print(e)
        sys.exit()


documents = getDocuments({
    'roi2': {
        '$exists': False
    },
    'freezeAuth': False,
    'mintAuth': False,
    'datetime': {
        '$gte': datetime(2024, 5, 17, 0, 0, 0, tzinfo=timezone.utc)
    },
    'error': {
        '$exists': False
    },
    'topHolders0': {
        '$exists': True
    },
    'prediction': {
        '$exists': False
    },
    'topHolders0': {
        '$size': 20
    }
})
for document in documents:
    success = checkBuy(document)
    print(bool(success[0]))
    updateDocument(document['_id'], {'prediction': bool(success[0])})
