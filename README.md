# ohcrop

## 📌 Abstract

As climate change has progressed, so too has the onset of disease among crops caused by a mixture of increased temperatures and increased humidity. Already, the estimated loss in crops by the onset of climate change has hit over $30 Billion per year, and as such farmers more then ever must seriously consider the specific issues caused as the climate increases. This hits especially close to Wisconsin, which is the 10th biggest agricultural producer in the United States while only being 21st among states for population.

---

## 🔍 Overview

We, as engineers, are not used to the programming-heavy environment of hackathons, yet we still felt we had something to provide when it came to creating a hardware solution. As such, we created a fully integrated Arduino-based solution running a local LLM model, and tuned it to be able to pick up on crop disease in plants. It is best at corn plants, and therefore we have decided to use corn, the third biggest crop export of Wisconsin, as our basis point. In the future, we hope to make it self-powered, run off of solar batteries, so it may go out into the field, and weatherproof it.

---

## 🛠️ Usage

The Arduino kit is mounted onto two poles and is placed into the ground, where it will scan the crop fields of the user and upload data into the **Oh, Crop!** application. This will update the farmer on the specific issues with their fields and let them know what the best fix may be using the **field insights** function.

---

## 📸 Handheld Camera Function

While by default the entire chassis is integrated, the camera can be removed with the **M5 Substack** attached, which will update the model with the correct camera position to gain 100% accurate data on the crop disease.

---

### ⚠️ Notes
- The **FieldSense** code was partially written using **Codex**.
- All Arduino code is done by hand.
- All 3D modeling is also done by hand.