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


def get_data(num=20):
    documents = getDocuments({
    'burned': True,
    'mintAuth': False,
    'freezeAuth': False,
    'LiquiditySOL': {
        '$gte': 10
    },
    '24Price': {
        '$exists': True
    }
})
    df = pd.DataFrame(list(documents))
    # Add ROI column based on inputted num using num + 'Price' as the key for the price to use for roi calculation
    df[str(num)+'Price'] = df[str(num)+'Price'].astype(float)
    df['BPrice'] = df['BPrice'].astype(float)
    df['roi' + str(num)] = (df[str(num)+'Price'] - df['BPrice']) / df['BPrice']
    df['roi' + str(num) + '_success'] = df['roi' + str(num)].apply(lambda x: 1 if x > 2 else 0)
    df.drop('roi' + str(num), axis=1, inplace=True)
    df.drop('_id', axis=1, inplace=True)
    top_columns = df.filter(regex='^top', axis=1).columns
    top_columns = top_columns.drop('top20Total0', errors='ignore')
    top_columns = top_columns.drop('topHolders0', errors='ignore')
    df.drop(top_columns, axis=1, inplace=True)
    price_columns = df.filter(regex='Price', axis=1).columns
    price_columns = price_columns.drop('LPrice', errors='ignore')
    price_columns = price_columns.drop('BPrice', errors='ignore')
    df.drop(price_columns, axis=1, inplace=True)
    df.drop('coin', axis=1, inplace=True)
    df.drop('owner', axis=1, inplace=True)
    df.drop('SPLAddress', axis=1, inplace=True)
    df.drop('checked', axis=1, inplace=True)
    df.drop('error', axis=1, inplace=True)
    for col in df.columns:
        if df[col].dtype == np.bool_:
            df[col] = df[col].astype(int)
    df.drop('datetime', axis=1, inplace=True)
    topHolders_df = df['topHolders0'].apply(pd.Series)
    topHolders_df = topHolders_df.rename(columns=lambda x: 'topHolder_' + str(x))
    df = pd.concat([df[:], topHolders_df[:]], axis=1)
    df = df.drop('topHolders0', axis=1)
    pd.set_option('display.max_columns', None)
    df.dropna(inplace=True)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(bool).astype(int)
    return df

def run_gridsearch_cv(X_train, y_train):
    # Define the parameter grid
    param_grid = {
        'max_depth': [3, 4, 5, 7, 10, 12],
        'learning_rate': [0.05, 0.01, 0.1, 0.2, 0.3],
        'gamma': [0, 0.1, 0.2, 0.3, 0.4, 0.5],
        'reg_lambda': [0, 1.0, 10.0, 20.0, 50.0, 100.0],
        'scale_pos_weight': [1, 3, 5, 7, 9],
        'min_child_weight': [1, 3, 5, 7]
    }

    # Initialize XGBClassifier
    xgb_clf = xgb.XGBClassifier(objective='binary:logistic', eval_metric='auc')

    # Initialize GridSearchCV
    grid_cv = GridSearchCV(xgb_clf, param_grid, scoring='roc_auc', cv=5, n_jobs=-1, verbose=3)

    # Fit the GridSearchCV object to the data
    grid_cv.fit(X_train, y_train)

    # Print the best parameters and best score
    print("Best Parameters: ", grid_cv.best_params_)
    print("Best Score: ", grid_cv.best_score_)
    return grid_cv.best_params_


def train_model(num=2):
    df = get_data(num)
    print(df['roi' + str(num) + '_success'].value_counts())
    X_train, X_test, y_train, y_test = train_test_split(df.drop('roi' + str(num) + '_success', axis=1), df['roi' + str(num) + '_success'], test_size=0.6, random_state=42, stratify=df['roi' + str(num) + '_success'])
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dtest = xgb.DMatrix(X_test, label=y_test)
    params = {
        'max_depth': 6,
        'eta': 0.1,
        'objective': 'binary:logistic',
        'eval_metric': 'auc',
        'gamma': 0.2,
        'reg_lambda': 0,
        'scale_pos_weight': 2
    }
    evals_result = {}
    model = xgb.train(params, dtrain, num_boost_round=5000, evals=[(dtrain, 'train'), (dtest, 'test')],
                      evals_result=evals_result, early_stopping_rounds=20)
    y_pred = model.predict(dtest)
    print(y_test)
    y_pred_binary = [1 if p >= 0.5 else 0 for p in y_pred]
    accuracy = accuracy_score(y_test, y_pred_binary)
    print("Accuracy: %.2f%%" % (accuracy * 100.0))
    xgb.plot_tree(model, num_trees=0)
    plt.show()
    with open('xgboost_model'+str(num)+'.pkl', 'wb') as file:
        pickle.dump(model, file)
    return y_pred_binary, y_test.tolist()  # Return the test set predictions and actual values


predictions, actuals = train_model(20)


# Compare the predicted successes with the actual successes
true_positives = sum([pred == act == 1 for pred, act in zip(predictions, actuals)])
true_negatives = sum([pred == act == 0 for pred, act in zip(predictions, actuals)])
false_positives = sum([pred == 1 and act == 0 for pred, act in zip(predictions, actuals)])
false_negatives = sum([pred == 0 and act == 1 for pred, act in zip(predictions, actuals)])

print(f"True Positives: {true_positives}")
print(f"True Negatives: {true_negatives}")
print(f"False Positives: {false_positives}")
print(f"False Negatives: {false_negatives}")

