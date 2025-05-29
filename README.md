---

# MenuVLM

---

This is a full-stack application designed to extract menu items from image files using Artificial Intelligence. It's a hands-on demonstration of integrating modern frontend and backend technologies with AI capabilities, built as a **resume project**.

---

## Main Feature


* **AI-Powered Extraction:** Leverage a local or remote AI model (through Ollama) to parse and extract menu items (dishes, prices, descriptions) from uploaded images.


---

## Technologies Used

This project is a full-stack application built with the following technologies:

* **Frontend:**
    * **Tailwind CSS:**
    * **JavaScript** For dynamic interactions, API calls, and UI logic.
* **Backend:**
    * **Node.js**
    * **Express.js** 
    * **TypeScript**
* **AI Model:**
    * **Ollama:** A powerful tool for running large language models locally. This project assumes you have Ollama installed and a suitable model (e.g., `qwen2.5vl:7b`) pulled and running.

---

## Setup and Installation
### Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js and npm**
2.  **Ollama**
3.  **An Ollama Model:** After installing Ollama, pull a suitable multimodal model. The `llava` model is recommended for image understanding:
    ```bash
    ollama pull qwen2.5vl:7b
    ```
    Ensure Ollama is running in the background.

### Backend Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Build the TypeScript project:**
    ```bash
    npm run build
    ```
3.  **Start the backend server:**
    ```bash
    npm start
    ```
    The backend server will start on `http://localhost:3000`. 

### Frontend Setup

The frontend is a static HTML, CSS, and JavaScript application.

1.  **Open `index.html`**

---

## How It Works

The Express.js server acts as the bridge between the frontend and the AI model.
* It exposes one key API endpoint:
    * **`POST /api/upload-image`**:
        * Receives the uploaded image file using `multer`.
        * Sends the image (and a relevant prompt) to the local or remotelly running **Ollama `vision` model**.
        * Processes the AI's response to extract structured menu data.
        * Returns the extracted menu JSON to the frontend.
* Handles CORS to allow communication between the frontend and backend.

### AI Integration (Ollama)

* The backend interacts with Ollama via its API.
* For image processing, a vision model like `qwen2.5vl` is used to understand the visual content of the menu image and extract textual information into a structured JSON format.

---

## ⚠️ Important Note: Resume Project Only

Please be aware that this project is intended solely as a **resume piece** to demonstrate technical skills in full-stack development, AI integration, and UI/UX design.

---
