# https://www.kaggle.com/code/arancium/logistic-regression-titanic-score-0-76315

# File Management
import os
if not os.path.exists("output"):
    os.mkdir("output")

# Data treatment
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

# Visual
import pylab
import matplotlib.pyplot as plt
# %matplotlib inline

# Machine Learning 
from sklearn.linear_model import LogisticRegression

# Data Visualization
import seaborn as sns
import scipy.stats as stats

if __name__ == "__main__":

    print("Starting")

    # Data Sets
    TrainSet = pd.read_csv("./data/train.csv")
    TestSet = pd.read_csv("./data/test.csv")

    # Exploring the data
    # TrainSet.info()    

    # Delete irrelevant columns
    TrainSet =  TrainSet.drop('Name', axis=1)
    TestSet =  TestSet.drop('Name', axis=1)

    # Convert the objects to integers
    le = LabelEncoder()

    TrainSet.Sex = le.fit_transform(TrainSet.Sex)
    TrainSet.Embarked = le.fit_transform(TrainSet.Embarked)
    TrainSet.Ticket = le.fit_transform(TrainSet.Ticket)
    TrainSet.Cabin = le.fit_transform(TrainSet.Cabin)

    TestSet.Sex = le.fit_transform(TestSet.Sex)
    TestSet.Embarked = le.fit_transform(TestSet.Embarked)
    TestSet.Ticket = le.fit_transform(TestSet.Ticket)
    TestSet.Cabin = le.fit_transform(TestSet.Cabin)
    # DEBUG
    # model_mapping = {index : label for index, label in enumerate(le.classes_)}
    # print(model_mapping)

    # Analysis

    # View Counts
    # print(TrainSet.value_counts())
    # print(TrainSet['Survived'].value_counts())

    # View hist
    TrainSet.hist(bins=50, figsize=(20, 15))
    plt.savefig('output/hist.png')
    # plt.show()

    # Descriptive statistics
    print(TrainSet.describe())

    # Linear correlation with the data set
    fig, ax = plt.subplots(nrows=1, ncols=1, figsize=(8, 6))
    sns.heatmap(
        TrainSet.corr(),
        annot     = True,
        cbar      = False,
        annot_kws = {"size": 8},
        vmin      = -1,
        vmax      = 1,
        center    = 0,
        cmap      = "RdYlGn",
        square    = True,
        ax        = ax
    )
    ax.set_xticklabels(
        ax.get_xticklabels(),
        rotation = 45,
        horizontalalignment = 'right',
    )
    ax.tick_params(labelsize = 10)
    plt.savefig('output/heatmap.png')

    # Start training
    # 0.76315
    Train = TrainSet[['PassengerId','Survived','Pclass','Age','Sex','Ticket','Fare','Cabin','Embarked','SibSp']]
    Test = TestSet[['PassengerId','Pclass','Age','Sex','Ticket','Fare','Cabin','Embarked','SibSp']]

    # Filling the missing values with the mean
    print(Train.isna().sum())
    print(Test.isna().sum())
    mean_age_train = Train['Age'].mean()
    mean_age_test = Test['Age'].mean()
    Train["Age"].fillna(mean_age_train, inplace=True)
    # Train.fillna(mean_age_train, inplace=True)
    Test.fillna(mean_age_test, inplace=True)
    print(Train.isna().sum())
    print(Test.isna().sum())

    # Split the data
    X_train = Train.drop('Survived', axis=1)
    y_train = Train[['Survived']]

    # Logistic
    clf = LogisticRegression()
    clf.fit(X_train, y_train)

    # Predict
    y_pred = clf.predict(Test)

    # Generate output
    sub = {'PassengerId': TestSet.PassengerId,'Survived': y_pred }
    sub = pd.DataFrame(data=sub)
    sub.to_csv('./output/submission.csv', index=False)

    print("Done")