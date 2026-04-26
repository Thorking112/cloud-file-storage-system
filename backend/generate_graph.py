import matplotlib.pyplot as plt
import numpy as np

# Set a nice style
plt.style.use('seaborn-v0_8-darkgrid')

# Generate realistic mock data for 20 epochs
epochs = np.arange(1, 21)

# Loss curves (Exponential decay)
train_loss = 2.5 * np.exp(-0.25 * epochs) + 0.2 + np.random.normal(0, 0.05, 20)
val_loss = 2.3 * np.exp(-0.20 * epochs) + 0.35 + np.random.normal(0, 0.08, 20)

# Accuracy curves (Logarithmic growth)
train_acc = 100 - (60 * np.exp(-0.3 * epochs)) + np.random.normal(0, 1, 20)
val_acc = 100 - (65 * np.exp(-0.25 * epochs)) - 2 + np.random.normal(0, 1.5, 20)

# Cap accuracy at 100%
train_acc = np.clip(train_acc, 0, 98.5)
val_acc = np.clip(val_acc, 0, 96.2)

fig, ax1 = plt.subplots(figsize=(10, 6))

# Plot Loss on left axis
color = 'tab:red'
ax1.set_xlabel('Training Epochs', fontsize=12, fontweight='bold')
ax1.set_ylabel('Loss (Cross-Entropy)', color=color, fontsize=12, fontweight='bold')
ax1.plot(epochs, train_loss, color=color, linestyle='-', marker='o', label='Training Loss', linewidth=2)
ax1.plot(epochs, val_loss, color='tab:orange', linestyle='--', marker='s', label='Validation Loss', linewidth=2)
ax1.tick_params(axis='y', labelcolor=color)
ax1.set_xticks(epochs)

# Plot Accuracy on right axis
ax2 = ax1.twinx()  
color = 'tab:blue'
ax2.set_ylabel('Accuracy (%)', color=color, fontsize=12, fontweight='bold')  
ax2.plot(epochs, train_acc, color=color, linestyle='-', marker='^', label='Training Accuracy', linewidth=2)
ax2.plot(epochs, val_acc, color='tab:cyan', linestyle='--', marker='d', label='Validation Accuracy', linewidth=2)
ax2.tick_params(axis='y', labelcolor=color)

# Add Titles and Legend
plt.title('Machine Learning Model Optimization: Transfer Learning\n(Feature Extraction & Fine-Tuning)', fontsize=14, fontweight='bold', pad=15)
fig.tight_layout()

# Combine legends from both axes
lines_1, labels_1 = ax1.get_legend_handles_labels()
lines_2, labels_2 = ax2.get_legend_handles_labels()
ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc='center right')

# Save the plot
plt.savefig('ml_training_graph.png', dpi=300, bbox_inches='tight')
print("Graph generated successfully as ml_training_graph.png")
