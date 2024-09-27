import pandas as pd
import gspread
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from pymongo import MongoClient

def getCredentials():
    flow = InstalledAppFlow.from_client_secrets_file(
        'sheetsCred.json', SCOPES)

    creds = flow.run_local_server(port=0)
    with open('token.json', 'w') as token:
        token.write(creds.to_json())

    return creds

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['main']
collection = db['liquidityEnabled']

# Fetch data from MongoDB
data = list(collection.find({'checked': True, 'burned': True}))
df = pd.DataFrame(data)
df = df.drop('_id', axis=1)
df['datetime'] = df['datetime'].astype(str)
df['burnTime'] = df['burnTime'].astype(str)
# Drop 'checked' and 'burned' columns
df = df.drop(['checked', 'burned'], axis=1)

# Convert 'freezeAuth' to string
df['freezeAuth'] = df['freezeAuth'].astype(str)

# Use credentials to create a client to interact with the Google Drive API
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SPREADSHEET_ID = ""

creds = getCredentials()
if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        raise Exception('No valid credentials found')

client2 = gspread.authorize(creds)

# Open the Google Sheet and get the worksheet named "data"
worksheet = client2.open_by_key(SPREADSHEET_ID).worksheet("data")

# Clear existing data in the worksheet
worksheet.clear()

# Get the headers from the dataframe
headers = df.columns.tolist()

# Append the headers to the worksheet
worksheet.append_row(headers)

# Update Google sheet with data
# Fetch existing data from Google Sheet
existing_data = worksheet.get_all_values()
existing_df = pd.DataFrame(existing_data[1:], columns=existing_data[0])

# Update Google sheet with data
for index, row in df.iterrows():
    # Check if 'coin' value is already present in the Google Sheet
    if row['coin'] not in existing_df['coin'].values:
        worksheet.append_row(row.tolist())
