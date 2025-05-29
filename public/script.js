const imageInput = document.getElementById('imageInput');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingText = document.getElementById('loadingText');
const messageBox = document.getElementById('messageBox');
const messageBoxTitle = document.getElementById('messageBoxTitle');
const messageBoxContent = document.getElementById('messageBoxContent');
const closeMessageBoxBtn = document.getElementById('closeMessageBoxBtn');
const historyList = document.getElementById('historyList');
const noHistoryMessage = document.getElementById('noHistoryMessage');
const jsonModal = document.getElementById('jsonModal'); 
const jsonContent = document.getElementById('jsonContent');
const closeJsonModalBtn = document.getElementById('closeJsonModalBtn');
const mainAppContainer = document.getElementById('main-app-container'); 
const uploadSection = document.getElementById('upload-section');
const historySection = document.getElementById('history-section');
const sessionHistory = [];

function showMessageBox(title, message) {
    messageBoxTitle.textContent = title;
    messageBoxContent.textContent = message;
    messageBox.classList.remove('hidden');
}

function hideMessageBox() {
    messageBox.classList.add('hidden');
}


function showJsonModal(json) {
    jsonContent.textContent = JSON.stringify(json, null, 2);
    jsonModal.classList.remove('hidden');
}

function hideJsonModal() {
    jsonModal.classList.add('hidden');
}

async function testServerConnection() {
    const testUrl = 'http://localhost:3000/api/test-connection';
    try {
        const response = await fetch(testUrl);
        if (response.ok) {
            const data = await response.json();
            showMessageBox('Server Connected!', data.message);
        } else {
            showMessageBox('Server Not Connected', `Failed to connect to server. Status: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        showMessageBox('Network Error!', `Could not connect to the Express server. Please ensure it's running and accessible at ${testUrl}.`);
    }
}

function updateLayout() {
    if (sessionHistory.length > 0) {
        
        mainAppContainer.classList.remove('items-center', 'justify-center'); 
        mainAppContainer.classList.add('items-stretch', 'justify-start'); 

        historySection.classList.remove('hidden'); 
        historySection.classList.add('flex-grow'); 

        uploadSection.classList.remove('max-w-md', 'mx-auto'); 
        uploadSection.classList.add('w-full', 'lg:max-w-xl', 'lg:mx-auto', 'mt-8');
    } else {
        
        mainAppContainer.classList.add('items-center', 'justify-center'); 
        mainAppContainer.classList.remove('items-stretch', 'justify-start');

        historySection.classList.add('hidden'); 
        historySection.classList.remove('flex-grow');

        uploadSection.classList.add('max-w-md', 'mx-auto'); 
        uploadSection.classList.remove('w-full', 'lg:max-w-xl', 'lg:mx-auto', 'mt-8');
    }
    
    document.body.classList.add('flex', 'flex-col', 'items-center', 'justify-center');
}


function renderHistory() {
    historyList.innerHTML = '';
    if (sessionHistory.length === 0) {
        historyList.appendChild(noHistoryMessage);
        noHistoryMessage.classList.remove('hidden');
    } else {
        noHistoryMessage.classList.add('hidden');
        sessionHistory.forEach((item, index) => {
            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = 'bg-white p-4 rounded-xl shadow-md flex flex-col items-center text-center gap-3 border border-slate-200 hover:shadow-lg transition-shadow duration-200 cursor-pointer';

            const img = document.createElement('img');
            img.src = item.localImageUrl;
            img.alt = `Uploaded Image ${index + 1}`;
            img.className = 'w-32 h-32 object-cover rounded-lg border border-gray-200';

            const title = document.createElement('p');
            title.className = 'font-semibold text-gray-800 text-lg mt-2 truncate w-full px-2'; 
            title.textContent = `${item.originalFilename || 'Uploaded Image'}`;

            const timestamp = document.createElement('p');
            timestamp.className = 'text-sm text-gray-500 mb-2';
            timestamp.textContent = new Date(item.timestamp).toLocaleString();

            const viewJsonBtn = document.createElement('button');
            viewJsonBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 mt-2';
            viewJsonBtn.textContent = 'View Menu JSON';
            viewJsonBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showJsonModal(item.menu);
            });

            historyItemDiv.appendChild(img);
            historyItemDiv.appendChild(title);
            historyItemDiv.appendChild(timestamp);
            historyItemDiv.appendChild(viewJsonBtn);

            historyList.appendChild(historyItemDiv);
        });
    }
    updateLayout(); 
}

uploadImageBtn.addEventListener('click', async () => {
    const serverUrl = 'http://localhost:3000/api/upload';
    const file = imageInput.files[0];

    if (!file) {
        showMessageBox('No File Selected', 'Please select an image file to upload.');
        return;
    }

    const localImageUrl = URL.createObjectURL(file);
    const originalFilename = file.name;

    loadingIndicator.classList.remove('hidden');
    uploadImageBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(serverUrl, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            showMessageBox('Success!', data.message || 'Image uploaded and processed successfully!');

            sessionHistory.push({
                localImageUrl: localImageUrl,
                originalFilename: originalFilename,
                menu: data.menu,
                timestamp: data.timestamp
            });
            renderHistory();
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));

            if (response.status === 400 && errorData && errorData.error === "true") {
                showMessageBox('AI Recognition Error', errorData.message);
            } else {
                showMessageBox('Error!', errorData.message || `Failed to get a successful response from the server. Status: ${response.status}`);
            }
        }
    } catch (error) {
        showMessageBox('Network Error!', `Could not connect to the Express server. Please ensure it's running and accessible at ${serverUrl}.`);
    } finally {
        loadingIndicator.classList.add('hidden');
        uploadImageBtn.disabled = false;
    }
});

closeMessageBoxBtn.addEventListener('click', hideMessageBox);
closeJsonModalBtn.addEventListener('click', hideJsonModal);

document.addEventListener('DOMContentLoaded', () => {
    testServerConnection();
    renderHistory(); 
});
