#Isolation Forest
#anomaly detection

"""
Anomaly Detection Interpretation (Isolation Forest):

- `anomaly_score` is a RELATIVE score, not an absolute risk value.
  Higher values indicate more "normal" behavior compared to peers,
  while lower (often negative) values indicate unusual deviation.

- A score close to 0.0 means the system closely matches the learned
  baseline of the dataset and is NOT statistically unusual.

- `is_anomalous = False` means this system does NOT significantly
  deviate from other systems it was compared against.
  This does NOT mean the system is secure or risk-free.

IMPORTANT:
- Anomaly detection identifies statistical outliers, NOT vulnerabilities.
- Results depend on the comparison dataset (organization context).
- Anomalies are signals for investigation, not proof of compromise.
"""


from sklearn.ensemble import IsolationForest


# from day2 import run_day2_scan

def train_anomaly_model(feature_list):
    """ Train Isolation Forest on a list of feature dictionaries. """

    # Convert list of dicts → list of lists
    keys=sorted(feature_list[0].keys())
    X=[[features[k] for k in keys] for features in feature_list]

    model=IsolationForest(n_estimators=100,contamination=0.15, random_state=42)

    model.fit(X)

    return model, keys


def score_anomaly(model, keys, features):
    """Score a single machine"""

    X=[[features[k] for k in keys]]

    anomaly_score=model.decision_function(X)[0]

    prediction= model.predict(X)[0]

    return{"anomaly_score":anomaly_score, "is anomalous": True if prediction == -1 else False}


# scan_result=run_day2_scan()
# model,f_keys=train_anomaly_model([scan_result["features"]])

# result=score_anomaly(model,f_keys,scan_result["features"])

# sscan={}
# sscan["Anomaly_assessment"]=result

# print(sscan)



