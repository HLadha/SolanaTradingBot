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
def get_data(num=2):
    documents = getDocuments({"roi2":{"$exists":True}, "freezeAuth": False, "mintAuth": False})
    df = pd.DataFrame(list(documents))
    df.drop('_id', axis=1, inplace=True)
    top_columns = df.filter(regex='^top', axis=1).columns
    top_columns = top_columns.drop('top20Total0', errors='ignore')
    top_columns = top_columns.drop('topHolders0', errors='ignore')
    df.drop(top_columns, axis=1, inplace=True)
    roi_columns = df.filter(regex='roi', axis=1).columns
    roi_columns = roi_columns.drop('roi' + str(num)+'_success', errors='ignore')
    df.drop(roi_columns, axis=1, inplace=True)
    df.drop('coin', axis=1, inplace=True)
    df.drop('owner', axis=1, inplace=True)
    df.drop('SPLAddress', axis=1, inplace=True)
    df.drop('checked', axis=1, inplace=True)
    df.drop('error', axis=1, inplace=True)
    for col in df.columns:
        if df[col].dtype == np.bool_:
            df[col] = df[col].astype(int)
    df.drop('datetime', axis=1, inplace=True)
    df.drop('burnTime', axis=1, inplace=True)
    topHolders_df = df['topHolders0'].apply(pd.Series)
    topHolders_df = topHolders_df.rename(columns=lambda x: 'topHolder_' + str(x))
    df = pd.concat([df[:], topHolders_df[:]], axis=1)
    df = df.drop('topHolders0', axis=1)
    df.dropna(inplace=True)
    pd.set_option('display.max_columns', None)
    return df

# Load the models (2-24 in different model(num) values)
models = {}
for i in range(2, 25, 2):
    with open(f'xgboost_model{i}.pkl', 'rb') as file:
        models[i] = pickle.load(file)

# Load the data
dataset = []
for i in range(2, 25, 2):
    data = get_data(i)
    dataset.append(data)

# Predict the results
results = {}
for i, data in zip(range(2, 25, 2), dataset):
    dmatrix = xgb.DMatrix(data.drop(f'roi{i}_success', axis=1))
    results[i] = models[i].predict(dmatrix)

# make variable successes contain all the success columns from the dataset (should be 12 columns)
successes = [data[f'roi{i}_success'] for i, data in zip(range(2, 25, 2), dataset)]
# make variable success that aggregates the successes, so if value one in any of the columns, it should be 1
success = np.any(successes, axis=0)



# Aggregate the results into a dataframe with the columns as the number of hours
results_df = pd.DataFrame(results)

# Best Parameters:  {'gamma': 0, 'learning_rate': 0.01, 'max_depth': 10, 'min_child_weight': 1, 'reg_lambda': 0, 'scale_pos_weight': 1}
#create the final model with these parameters
X_train, X_test, y_train, y_test = train_test_split(results_df, success, test_size=0.4, random_state=42, stratify=success)
final_model = xgb.XGBClassifier(objective='binary:logistic', eval_metric='auc', gamma=0, learning_rate=0.01, max_depth=10, min_child_weight=1, reg_lambda=0, scale_pos_weight=1)
final_model.fit(X_train, y_train)

# print accuracy
y_pred = final_model.predict(X_test)
print(accuracy_score(y_test, y_pred))

predictions, actuals = y_pred, y_test.tolist()

true_positives = sum([pred == act == 1 for pred, act in zip(predictions, actuals)])
true_negatives = sum([pred == act == 0 for pred, act in zip(predictions, actuals)])
false_positives = sum([pred == 1 and act == 0 for pred, act in zip(predictions, actuals)])
false_negatives = sum([pred == 0 and act == 1 for pred, act in zip(predictions, actuals)])

print(f"True Positives: {true_positives}")
print(f"True Negatives: {true_negatives}")
print(f"False Positives: {false_positives}")
print(f"False Negatives: {false_negatives}")

#save the final model
with open('final_model.pkl', 'wb') as file:
    pickle.dump(final_model, file)
