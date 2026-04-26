import matplotlib.pyplot as plt
from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import numpy as np

# 1. Fetch a REAL outside dataset
# We use the famous '20 Newsgroups' dataset which contains thousands of real-world noisy text documents.
print("Downloading real-world text dataset from external source (20 Newsgroups)...")
categories = ['sci.med', 'sci.space', 'comp.graphics']
newsgroups = fetch_20newsgroups(subset='all', categories=categories, remove=('headers', 'footers', 'quotes'))

X_raw = newsgroups.data
y = newsgroups.target
print(f"Successfully loaded {len(X_raw)} real-world documents.")

# 2. Vectorize the text using TF-IDF
print("Vectorizing text...")
# We use 1000 features and remove stop words to force the neural network to find deep patterns
vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
X = vectorizer.fit_transform(X_raw)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# 3. Train a REAL Neural Network (Multi-Layer Perceptron)
print("Training Neural Network (MLP Classifier)...")
mlp = MLPClassifier(hidden_layer_sizes=(32,), max_iter=80, alpha=0.01,
                    solver='sgd', tol=1e-4, random_state=1,
                    learning_rate_init=0.1)

# We want to capture validation accuracy at each epoch, so we'll do partial_fit
classes = np.unique(y)
train_loss = []
train_acc = []
val_acc = []

epochs = 80
for epoch in range(epochs):
    mlp.partial_fit(X_train, y_train, classes=classes)
    
    # Record actual loss from gradient descent
    train_loss.append(mlp.loss_)
    
    # Record actual accuracy on training set
    train_acc.append(accuracy_score(y_train, mlp.predict(X_train)) * 100)
    
    # Record actual accuracy on validation/test set
    val_acc.append(accuracy_score(y_test, mlp.predict(X_test)) * 100)

print("Training Complete!")
print(f"Final Training Accuracy: {train_acc[-1]:.2f}%")
print(f"Final Validation Accuracy: {val_acc[-1]:.2f}%")

# 4. Plot the REAL metrics mathematically derived from the model
plt.style.use('seaborn-v0_8-darkgrid')
fig, ax1 = plt.subplots(figsize=(10, 6))

color = 'tab:red'
ax1.set_xlabel('Training Epochs', fontsize=12, fontweight='bold')
ax1.set_ylabel('Loss (Cross-Entropy)', color=color, fontsize=12, fontweight='bold')
ax1.plot(range(1, epochs+1), train_loss, color=color, linestyle='-', linewidth=2, label='Actual Training Loss')
ax1.tick_params(axis='y', labelcolor=color)

ax2 = ax1.twinx()  
color = 'tab:blue'
ax2.set_ylabel('Accuracy (%)', color=color, fontsize=12, fontweight='bold')  
ax2.plot(range(1, epochs+1), train_acc, color=color, linestyle='-', linewidth=2, label='Training Accuracy')
ax2.plot(range(1, epochs+1), val_acc, color='tab:cyan', linestyle='--', linewidth=2, label='Validation Accuracy')
ax2.tick_params(axis='y', labelcolor=color)

plt.title('Real Neural Network Training: Text Classification Model\n(MLP Classifier with SGD Optimizer on 20 Newsgroups Dataset)', fontsize=14, fontweight='bold', pad=15)
fig.tight_layout()

lines_1, labels_1 = ax1.get_legend_handles_labels()
lines_2, labels_2 = ax2.get_legend_handles_labels()
ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc='center right')

plt.savefig('real_ml_graph.png', dpi=300, bbox_inches='tight')
print("Real graph saved as real_ml_graph.png")
