import boto3
import matplotlib.pyplot as plt
import numpy as np
import os
import tarfile
import os.path
import PIL
import tensorflow as tf

from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.models import Sequential
import tarfile

awslogin={
    "AWSAccessKeyId":"AKIAYHKBOUS3EP7V5XDL",
    "AWSSecretKey":"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",
    "region_name":"ap-southeast-1"
}
  
def get_aws_resource(service, awslogin):

    return boto3.resource(service,
                        aws_access_key_id=awslogin['AWSAccessKeyId'],
                        aws_secret_access_key=awslogin['AWSSecretKey'],
                        region_name=awslogin['region_name'])

print("TensorFlow Version: ", tf.__version__)
print("Keras Version: ", keras.__version__)

import pathlib
# fullPath = os.path.abspath("./" + 'cropped.tgz')  # or similar, depending on your scenario
# data_for_processing = keras.utils.get_file(myFile, 'file://'+fullPath)
dataset_url = "https://zipped-essimages.s3.ap-southeast-1.amazonaws.com/cropped.tgz"
data_dir = tf.keras.utils.get_file('cropped', origin=dataset_url, untar=True)
data_dir = pathlib.Path(data_dir)
# data_dir = tf.keras.utils.get_file(
#     fname="cropped.tgz", 
#     origin="https://zipped-essimages.s3.ap-southeast-1.amazonaws.com/cropped.tgz", 
#     extract=True,
# )

image_count = len(list(data_dir.glob('*/*.jpg')))
print(image_count)
# bikini = list(data_dir.glob('Women - Bikini Top/*'))
# PIL.Image.open(str(bikini[0]))


batch_size = 32
img_height = 360
img_width = 360

train_ds = tf.keras.utils.image_dataset_from_directory(
  data_dir,
  validation_split=0.1,
  subset="training",
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

val_ds = tf.keras.utils.image_dataset_from_directory(
  data_dir,
  validation_split=0.1,
  subset="validation",
  seed=123,
  image_size=(img_height, img_width),
  shuffle=False,
  batch_size=batch_size)

class_names = train_ds.class_names
print(class_names)

for image_batch, labels_batch in train_ds:
  print(image_batch.shape)
  print(labels_batch.shape)
  break

AUTOTUNE = tf.data.AUTOTUNE

train_ds = train_ds.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

num_classes = len(class_names)

model = Sequential([
  layers.Rescaling(1./255, input_shape=(img_height, img_width, 3)),
  layers.Conv2D(16, 3, padding='same', activation='relu'),
  layers.MaxPooling2D(),
  layers.Conv2D(32, 3, padding='same', activation='relu'),
  layers.MaxPooling2D(),
  layers.Conv2D(64, 3, padding='same', activation='relu'),
  layers.MaxPooling2D(),
  layers.Flatten(),
  layers.Dense(128, activation='relu'),
  layers.Dense(num_classes)
])

model.compile(optimizer='adam',
              loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
              metrics=['accuracy'])

model.summary()

epochs=15
history = model.fit(
  train_ds,
  validation_data=val_ds,
  epochs=epochs
)

acc = history.history['accuracy']
val_acc = history.history['val_accuracy']

loss = history.history['loss']
val_loss = history.history['val_loss']

epochs_range = range(epochs)

plt.figure(figsize=(8, 8))
plt.subplot(1, 2, 1)
plt.plot(epochs_range, acc, label='Training Accuracy')
plt.plot(epochs_range, val_acc, label='Validation Accuracy')
plt.legend(loc='lower right')
plt.title('Training and Validation Accuracy')

plt.subplot(1, 2, 2)
plt.plot(epochs_range, loss, label='Training Loss')
plt.plot(epochs_range, val_loss, label='Validation Loss')
plt.legend(loc='upper right')
plt.title('Training and Validation Loss')
plt.show()

# url = "https://www.google.com/imgres?imgurl=https%3A%2F%2Fdynamic.zacdn.com%2FbgOuFW5ZJilpE6LN3tZkdKX9jAw%3D%2Ffit-in%2F236x345%2Ffilters%3Aquality(95)%3Afill(ffffff)%2Fhttps%3A%2F%2Fstatic-hk.zacdn.com%2Fp%2Fozero-swimwear-6636-8071965-2.jpg&imgrefurl=https%3A%2F%2Fwww.zalora.com.hk%2Fwomen%2Fozero-swimwear%2F&tbnid=wX5SFKFP0X_iWM&vet=12ahUKEwiohdjqj__3AhVJFYgKHeGMDzwQMyhOegQIARBi..i&docid=srOmDRBDuhm_5M&w=236&h=345&itg=1&q=midriff&hl=en&ved=2ahUKEwiohdjqj__3AhVJFYgKHeGMDzwQMyhOegQIARBi#imgrc=rb_n_WIcKCgBdM&imgdii=tDprcHXPKuqBbM"
# url ='https://image.brazilianbikinishop.com/images/products/cache_images/set-blueman-bikini-recanto-0_525_500_defined.jpg'
# url='https://cdn.shopify.com/s/files/1/0158/2548/products/6089a1a948804ca7845f1db544a8d3e0.thumbnail.0000000_2048x.jpg?v=1650315975'
# url='https://hips.hearstapps.com/vader-prod.s3.amazonaws.com/1623693034-sommerswim-xena-halter-style-bikini-top-pascolo-front-2-1800x1800-1623693026.jpg'
# url='https://st.mngbcn.com/rcs/pics/static/T1/fotos/outfit/S20/17187883_99-99999999_01.jpg?ts=1625493947780&imwidth=412&imdensity=2'
# url='https://i5.walmartimages.com/asr/a53aab7f-7c3d-4782-97f4-38429eb5fd86_1.fb9bb846ececa21c84f46c99f17ccd8f.jpeg'
# url='https://m.media-amazon.com/images/I/61Vot0V7tpL._AC_UX385_.jpg'
# url='https://cdn11.bigcommerce.com/s-kzb5gokw13/images/stencil/1050x1050/products/139/486/117102550-1-1_58101f3c-b493-43c6-a5a0-566e8d562197__92711.1604477960.jpg'
url='https://st.mngbcn.com/rcs/pics/static/T1/fotos/outfit/S20/17187883_99-99999999_01.jpg?ts=1625493947780&imwidth=412&imdensity=2'
path = tf.keras.utils.get_file('1674.jpg',  origin=url)

img = tf.keras.utils.load_img(
    path, target_size=(img_height, img_width)
)
img_array = tf.keras.utils.img_to_array(img)
img_array = tf.expand_dims(img_array, 0) # Create a batch

predictions = model.predict(img_array)
score = tf.nn.softmax(predictions[0])

print(
    "This image most likely belongs to {} with a {:.2f} percent confidence."
    .format(class_names[np.argmax(score)], 100 * np.max(score))
)
