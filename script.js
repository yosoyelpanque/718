document.addEventListener('DOMContentLoaded', () => {
        
    let state = {
        loggedIn: false, currentUser: null, inventory: [], additionalItems: [],
        resguardantes: [], activeResguardante: null, locations: {}, areas: [], areaNames: {},
        lastAutosave: null, sessionStartTime: null, additionalPhotos: {}, locationPhotos: {},
        notes: {}, photos: {}, theme: 'light',
        inventoryFinished: false,
        areaDirectory: {},
        closedAreas: {},
        persistentAreas: [],
        serialNumberCache: new Set(),
        cameraStream: null,
        readOnlyMode: false,
        activityLog: [],
        institutionalReportCheckboxes: {},
        actionCheckboxes: {
            labels: {},
            notes: {},
            additional: {},
            mismatched: {},
            personal: {}
        },
        reportCheckboxes: {
            labels: {},
            notes: {},
            mismatched: {}
        }
    };
    
    let logoClickCount = 0; 

    function generateUUID() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

     const verifiers = {
        '41290': 'BENÍTEZ HERNÁNDEZ MARIO',
        '41292': 'ESCAMILLA VILLEGAS BRYAN ANTONY',
        '41282': 'LÓPEZ QUINTANA ALDO',
        '41287': 'MARIN ESPINOSA MIGUEL',
        '41289': 'SANCHEZ ARELLANES RICARDO',
        '41293': 'EDSON OSNAR TORRES JIMENEZ',
        '15990': 'CHÁVEZ SÁNCHEZ ALFONSO',
        '17326': 'DOMÍNGUEZ VAZQUEZ FRANCISCO JAVIER',
        '11885': 'ESTRADA HERNÁNDEZ ROBERTO',
        '19328': 'LÓPEZ ESTRADA LEOPOLDO',
        '44925': 'MENDOZA SOLARES JOSE JUAN',
        '16990': 'PÉREZ RODRÍguez DANIEL',
        '16000': 'PÉREZ YAÑEZ JUAN JOSE',
        '17812': 'RODRÍGUEZ RAMÍREZ RENE',
        '44095': 'LOPEZ JIMENEZ ALAN GABRIEL',
        '2875': 'VIZCAINO ROJAS ALVARO'
    };
    
    const photoDB = {
        db: null,
        init: function() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('InventarioProPhotosDB', 1);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
                };
                request.onsuccess = (event) => { this.db = event.target.result; resolve(); };
                request.onerror = (event) => { console.error('Error con IndexedDB:', event.target.errorCode); reject(event.target.errorCode); };
            });
        },
        setItem: function(key, value) {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(['photos'], 'readwrite');
                const store = transaction.objectStore('photos');
                const request = store.put(value, key);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        },
        getItem: function(key) {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(['photos'], 'readonly');
                const store = transaction.objectStore('photos');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        },
        deleteItem: function(key) {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(['photos'], 'readwrite');
                const store = transaction.objectStore('photos');
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        },
        getAllItems: function() {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(['photos'], 'readonly');
                const store = transaction.objectStore('photos');
                const keysRequest = store.getAllKeys();
                const valuesRequest = store.getAll();

                Promise.all([
                    new Promise((res, rej) => { keysRequest.onsuccess = () => res(keysRequest.result); keysRequest.onerror = (e) => rej(e.target.error); }),
                    new Promise((res, rej) => { valuesRequest.onsuccess = () => res(valuesRequest.result); valuesRequest.onerror = (e) => rej(e.target.error); })
                ]).then(([keys, values]) => {
                    const result = keys.map((key, index) => ({ key, value: values[index] }));
                    resolve(result);
                }).catch(reject);
            });
        }
    };

    const elements = {
        loginPage: document.getElementById('login-page'), mainApp: document.getElementById('main-app'),
        employeeNumberInput: document.getElementById('employee-number-input'),
        employeeLoginBtn: document.getElementById('employee-login-btn'),
        clearSessionLink: document.getElementById('clear-session-link'),
        currentUserDisplay: document.getElementById('current-user-name'),
        fileInput: document.getElementById('file-input'),
        uploadBtn: document.getElementById('upload-btn'), logoutBtn: document.getElementById('logout-btn'),
        dashboard: {
            headerAndDashboard: document.getElementById('header-and-dashboard'), // MEJORA 1
            toggleBtn: document.getElementById('dashboard-toggle-btn'),
            dailyProgressCard: document.getElementById('daily-progress-card'),
            progressTooltip: document.getElementById('progress-tooltip'),
        },
        totalItemsEl: document.getElementById('total-items'), locatedItemsEl: document.getElementById('located-items'),
        pendingItemsEl: document.getElementById('pending-items'), dailyProgressEl: document.getElementById('daily-progress'),
        workingAreasCountEl: document.getElementById('working-areas-count'),
        additionalItemsCountEl: document.getElementById('additional-items-count'),
        tabsContainer: document.getElementById('tabs-container'), tabContents: document.querySelectorAll('.tab-content'),
        mainContentArea: document.getElementById('main-content-area'),
        logo: {
            container: document.getElementById('logo-container'),
            img: document.getElementById('logo-img'),
            title: document.querySelector('#main-app header div:nth-child(1) > div:nth-child(2) > h2')
        },
        userForm: {
            name: document.getElementById('user-name'), locationSelect: document.getElementById('user-location-select'),
            locationManual: document.getElementById('user-location-manual'), areaSelect: document.getElementById('user-area-select'),
            createBtn: document.getElementById('create-user-btn'), list: document.getElementById('registered-users-list')
        },
        inventory: {
            tableBody: document.getElementById('inventory-table-body'),
            searchInput: document.getElementById('search-input'), qrScanBtn: document.getElementById('qr-scan-btn'),
            clearSearchBtn: document.getElementById('clear-search-btn'), ubicadoBtn: document.getElementById('ubicado-btn'),
            reEtiquetarBtn: document.getElementById('re-etiquetar-btn'), addNoteBtn: document.getElementById('add-note-btn'),
            prevPageBtn: document.getElementById('prev-page-btn'),
            nextPageBtn: document.getElementById('next-page-btn'), pageInfo: document.getElementById('page-info'),
            statusFilter: document.getElementById('status-filter'), areaFilter: document.getElementById('area-filter-inventory'),
            bookTypeFilter: document.getElementById('book-type-filter'),
            selectAllCheckbox: document.getElementById('select-all-checkbox')
        },
        adicionales: {
            form: document.getElementById('adicional-form'),
            addBtn: document.getElementById('add-adicional-btn'), list: document.getElementById('adicionales-list'),
            areaFilter: document.getElementById('ad-area-filter'),
            userFilter: document.getElementById('ad-user-filter'),
            printResguardoBtn: document.getElementById('print-adicionales-resguardo-btn'),
            total: document.getElementById('additional-items-total')
        },
        reports: {
            stats: document.getElementById('general-stats'), userFilter: document.getElementById('report-user-filter'),
            areaFilter: document.getElementById('report-area-filter'),
            reportButtons: document.querySelectorAll('.report-btn'),
            exportLabelsXlsxBtn: document.getElementById('export-labels-xlsx-btn'),
            tableContainer: document.getElementById('report-table-container'),
            tableTitle: document.getElementById('report-table-title'),
            tableBody: document.getElementById('report-table-body'),
            exportXlsxBtn: document.getElementById('export-xlsx-btn'),
        },
        settings: {
            themes: document.querySelectorAll('[data-theme]'), autosaveInterval: document.getElementById('autosave-interval'),
            loadedListsContainer: document.getElementById('loaded-lists-container'),
            exportSessionBtn: document.getElementById('export-session-btn'),
            importSessionBtn: document.getElementById('import-session-btn'),
            importFileInput: document.getElementById('import-file-input'),
            finalizeInventoryBtn: document.getElementById('finalize-inventory-btn'),
            summaryAuthor: document.getElementById('summary-author'),
            summaryAreaResponsible: document.getElementById('summary-area-responsible'),
            summaryLocation: document.getElementById('summary-location'),
            directoryContainer: document.getElementById('directory-container'),
            directoryCount: document.getElementById('directory-count'),
            aboutHeader: document.getElementById('about-header'),
            aboutContent: document.getElementById('about-content')
        },
        loadingOverlay: {
            overlay: document.getElementById('loading-overlay'),
            spinner: document.getElementById('loading-spinner'),
            text: document.getElementById('loading-text')
        },
        importProgress: {
            modal: document.getElementById('import-progress-modal'),
            text: document.getElementById('import-progress-text'),
            bar: document.getElementById('import-progress-bar')
        },
        confirmationModal: document.getElementById('confirmation-modal'), modalTitle: document.getElementById('modal-title'),
        modalText: document.getElementById('modal-text'), modalConfirmBtn: document.getElementById('modal-confirm'),
        modalCancelBtn: document.getElementById('modal-cancel'), toastContainer: document.getElementById('toast-container'),
        notesModal: document.getElementById('notes-modal'), noteTextarea: document.getElementById('note-textarea'),
        noteSaveBtn: document.getElementById('note-save-btn'), noteCancelBtn: document.getElementById('note-cancel-btn'),
        itemDetailsModal: {
            modal: document.getElementById('item-details-modal'),
            title: document.getElementById('item-details-title'),
            content: document.getElementById('item-details-content'),
            closeBtn: document.getElementById('item-details-close-btn')
        },
        qrDisplayModal: {
            modal: document.getElementById('qr-display-modal'),
            title: document.getElementById('qr-display-title'),
            container: document.getElementById('qr-code-display'),
            closeBtn: document.getElementById('qr-display-close-btn')
        },
        formatoEntradaModal: {
            modal: document.getElementById('formato-entrada-modal'),
            siBtn: document.getElementById('formato-entrada-si'),
            noBtn: document.getElementById('formato-entrada-no')
        },
        editAdicionalModal: {
            modal: document.getElementById('edit-adicional-modal'),
            form: document.getElementById('edit-adicional-form'),
            saveBtn: document.getElementById('edit-adicional-save-btn'),
            cancelBtn: document.getElementById('edit-adicional-cancel-btn')
        },
        photo: {
            modal: document.getElementById('photo-modal'),
            title: document.getElementById('photo-modal-title'),
            input: document.getElementById('photo-input'),
            message: document.getElementById('photo-message'),
            closeBtn: document.getElementById('photo-close-btn'),
            viewContainer: document.getElementById('photo-view-container'),
            uploadContainer: document.getElementById('photo-upload-container'),
            img: document.getElementById('item-photo-img'),
            deleteBtn: document.getElementById('delete-photo-btn'),
            useCameraBtn: document.getElementById('use-camera-btn'),
            cameraViewContainer: document.getElementById('camera-view-container'),
            cameraStream: document.getElementById('camera-stream'),
            photoCanvas: document.getElementById('photo-canvas'),
            captureBtn: document.getElementById('capture-photo-btn'),
            switchToUploadBtn: document.getElementById('switch-to-upload-btn')
        },
        editUserModal: document.getElementById('edit-user-modal'),
        editUserSaveBtn: document.getElementById('edit-user-save-btn'), editUserCancelBtn: document.getElementById('edit-user-cancel-btn'),
        editUserAreaSelect: document.getElementById('edit-user-area'), 
        qrScannerModal: document.getElementById('qr-scanner-modal'),
        qrReader: document.getElementById('qr-reader'), 
        qrScannerCloseBtn: document.getElementById('qr-scanner-close-btn'),
        areaClosure: {
            modal: document.getElementById('area-closure-modal'),
            title: document.getElementById('area-closure-title'),
            responsibleInput: document.getElementById('area-closure-responsible'),
            locationInput: document.getElementById('area-closure-location'),
            confirmBtn: document.getElementById('area-closure-confirm-btn'),
            cancelBtn: document.getElementById('area-closure-cancel-btn')
        },
        reassignModal: {
            modal: document.getElementById('reassign-modal'),
            title: document.getElementById('reassign-title'),
            text: document.getElementById('reassign-text'),
            areaSelect: document.getElementById('reassign-area-select'),
            confirmBtn: document.getElementById('reassign-confirm-btn'),
            keepBtn: document.getElementById('reassign-keep-btn'),
            deleteAllBtn: document.getElementById('reassign-delete-all-btn'),
            cancelBtn: document.getElementById('reassign-cancel-btn'),
        },
        readOnlyOverlay: document.getElementById('read-only-mode-overlay'),
        log: {
            modal: document.getElementById('log-modal'),
            content: document.getElementById('log-content'),
            showBtn: document.getElementById('show-log-btn'),
            closeBtn: document.getElementById('log-close-btn')
        },
        detailView: {
            modal: document.getElementById('item-detail-view-modal'),
            title: document.getElementById('detail-view-title'),
            closeBtn: document.getElementById('detail-view-close-btn'),
            photoContainer: document.getElementById('detail-view-photo-container'),
            photo: document.getElementById('detail-view-photo'),
            noPhoto: document.getElementById('detail-view-no-photo'),
            clave: document.getElementById('detail-view-clave'),
            descripcion: document.getElementById('detail-view-descripcion'),
            marca: document.getElementById('detail-view-marca'),
            modelo: document.getElementById('detail-view-modelo'),
            serie: document.getElementById('detail-view-serie'),
            usuario: document.getElementById('detail-view-usuario'),
            area: document.getElementById('detail-view-area'),
            areaWarning: document.getElementById('detail-view-area-warning'),
            ubicarBtn: document.getElementById('detail-view-ubicar-btn'),
            reetiquetarBtn: document.getElementById('detail-view-reetiquetar-btn'),
            notaBtn: document.getElementById('detail-view-nota-btn'),
            fotoBtn: document.getElementById('detail-view-foto-btn')
        },
        preprintModal: {
            modal: document.getElementById('preprint-edit-modal'),
            title: document.getElementById('preprint-title'),
            fieldsContainer: document.getElementById('preprint-fields'),
            confirmBtn: document.getElementById('preprint-confirm-btn'),
            cancelBtn: document.getElementById('preprint-cancel-btn')
        }
    };
    let currentPage = 1;
    const itemsPerPage = 8;
    let filteredItems = [];
    let html5QrCode;
    function recalculateLocationCounts() {
        state.locations = {};
        state.resguardantes.forEach(user => {
            const locationBase = user.location;
            if (locationBase) {
                 state.locations[locationBase] = (state.locations[locationBase] || 0) + 1;
            }
        });
        logActivity('Sistema', 'Recalculados los contadores de ubicación.');
    }

    function logActivity(action, details = '') {
        const timestamp = new Date().toLocaleString('es-MX');
        const logEntry = `[${timestamp}] ${action}: ${details}`;
        state.activityLog.push(logEntry);
    }

    function handleModalNavigation(modalElement) {
        const focusableElements = modalElement.querySelectorAll('button, [href], input, select, textarea');
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        firstElement.focus();

        const keydownHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            } else if (e.key === 'Enter') {
                const confirmBtn = modalElement.querySelector('#modal-confirm, #note-save-btn, #edit-adicional-save-btn, #edit-user-save-btn, #preprint-confirm-btn');
                if (confirmBtn && document.activeElement !== confirmBtn) {
                    e.preventDefault();
                    confirmBtn.click();
                }
            } else if (e.key === 'Escape') {
                const cancelBtn = modalElement.querySelector('#modal-cancel, #note-cancel-btn, #photo-close-btn, #edit-adicional-cancel-btn, #edit-user-cancel-btn, #log-close-btn, #preprint-cancel-btn');
                if (cancelBtn) cancelBtn.click();
            }
        };

        modalElement.addEventListener('keydown', keydownHandler);
        
        return () => modalElement.removeEventListener('keydown', keydownHandler);
    }


    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : (type === 'warning' ? 'bg-yellow-500' : 'bg-green-500');
        toast.className = `toast-notification show rounded-lg p-4 text-white shadow-lg transition-all duration-300 transform translate-y-2 opacity-0 ${bgColor}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }
    
    function showUndoToast(message, onUndo) {
        const toast = document.createElement('div');
        let timeoutId;

        const closeToast = () => {
            toast.classList.add('opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
            clearTimeout(timeoutId);
        };

        toast.className = 'toast-notification flex items-center justify-between show rounded-lg p-4 text-white shadow-lg transition-all duration-300 transform opacity-0 bg-slate-700';
        toast.innerHTML = `<span>${message}</span>`;

        const undoButton = document.createElement('button');
        undoButton.className = 'ml-4 font-bold underline';
        undoButton.textContent = 'Deshacer';
        undoButton.onclick = () => {
            onUndo();
            closeToast();
        };
        
        toast.appendChild(undoButton);
        elements.toastContainer.appendChild(toast);

        setTimeout(() => { toast.classList.remove('opacity-0'); }, 10);
        timeoutId = setTimeout(closeToast, 5000);
    }

    function updateSerialNumberCache() {
        state.serialNumberCache.clear();
        state.inventory.forEach(item => {
            if (item.SERIE) state.serialNumberCache.add(String(item.SERIE).trim().toLowerCase());
            if (item['CLAVE UNICA']) state.serialNumberCache.add(String(item['CLAVE UNICA']).trim().toLowerCase());
        });
        state.additionalItems.forEach(item => {
            if (item.serie) state.serialNumberCache.add(String(item.serie).trim().toLowerCase());
            if (item.clave) state.serialNumberCache.add(String(item.clave).trim().toLowerCase());
        });
    }
    
    function showConfirmationModal(title, text, onConfirm, options = {}) {
        const { confirmText = 'Confirmar', cancelText = 'Cancelar', onCancel = () => {} } = options;
        elements.modalCancelBtn.style.display = '';
        elements.modalTitle.textContent = title;
        elements.modalText.textContent = text;
        elements.modalConfirmBtn.textContent = confirmText;
        elements.modalCancelBtn.textContent = cancelText;
        elements.confirmationModal.classList.add('show');
        
        const cleanup = handleModalNavigation(elements.confirmationModal);

        const confirmHandler = () => {
            onConfirm();
            closeModal();
        };

        const cancelHandler = () => {
            onCancel();
            closeModal();
        };
        
        const closeModal = () => {
            elements.confirmationModal.classList.remove('show');
            elements.modalConfirmBtn.removeEventListener('click', confirmHandler);
            elements.modalCancelBtn.removeEventListener('click', cancelHandler);
            cleanup();
        };

        elements.modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        elements.modalCancelBtn.addEventListener('click', cancelHandler, { once: true });
    }

    function loadState() {
        try {
            const storedState = localStorage.getItem('inventarioProState');
            if (storedState) {
                const loaded = JSON.parse(storedState);
                const defaultState = { 
                    locationPhotos: {}, 
                    activityLog: [], 
                    institutionalReportCheckboxes: {},
                    actionCheckboxes: { labels: {}, notes: {}, additional: {}, mismatched: {}, personal: {} },
                    reportCheckboxes: { labels: {}, notes: {}, mismatched: {} } 
                }; 
                state = { ...defaultState, ...state, ...loaded };
                updateSerialNumberCache();
                return true;
            }
        } catch (e) { 
            console.error('Error al cargar el estado:', e);
            localStorage.removeItem('inventarioProState');
        }
        return false;
    }

    function deleteDB(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
            request.onblocked = () => {
                console.warn('La eliminación de IndexedDB fue bloqueada.');
                resolve(); 
            };
        });
    }
    
    async function resetInventoryState() {
        const currentUser = state.currentUser;
        const theme = state.theme;

        state = {
            loggedIn: true, currentUser, inventory: [], additionalItems: [],
            resguardantes: [], activeResguardante: null, locations: {}, areas: [], areaNames: {},
            lastAutosave: null, sessionStartTime: new Date().toISOString(), additionalPhotos: {}, locationPhotos: {},
            notes: {}, photos: {}, theme,
            inventoryFinished: false,
            areaDirectory: {},
            closedAreas: {},
            persistentAreas: [],
            serialNumberCache: new Set(),
            cameraStream: null,
            readOnlyMode: false,
            activityLog: [],
            institutionalReportCheckboxes: {},
            actionCheckboxes: {
                labels: {},
                notes: {},
                additional: {},
                mismatched: {},
                personal: {}
            },
            reportCheckboxes: {
                labels: {},
                notes: {},
                mismatched: {}
            }
        };
        
        try {
            await deleteDB('InventarioProPhotosDB');
            await photoDB.init(); 
            showToast('Se ha iniciado un nuevo inventario.', 'info');
            logActivity('Sesión reiniciada', `Nuevo inventario iniciado por ${currentUser.name}.`);
            saveState();
            showMainApp();
        } catch (error) {
            console.error("Error al reiniciar la base de datos de fotos:", error);
            showToast('No se pudo reiniciar la base de datos. Intenta recargar la página.', 'error');
        }
    }


    function saveState() {
        if (state.readOnlyMode) return;

        try {
            const stateToSave = { ...state };
            delete stateToSave.serialNumberCache;
            delete stateToSave.cameraStream;
            localStorage.setItem('inventarioProState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error('Error Crítico al guardar el estado:', e);
            
            state.readOnlyMode = true;
            
            checkReadOnlyMode(); 

            showConfirmationModal(
                '¡ALERTA! Almacenamiento Lleno',
                'No se puede guardar más progreso porque el almacenamiento del navegador está lleno. La aplicación se ha puesto en "Modo de Sólo Lectura" para prevenir pérdida de datos. Por favor, exporte su sesión actual desde la pestaña de Ajustes y comience una nueva sesión.',
                () => {},
                { confirmText: 'Entendido', cancelText: '' }
            );
            
            if(elements.modalCancelBtn) elements.modalCancelBtn.style.display = 'none';

            if (autosaveIntervalId) clearInterval(autosaveIntervalId);
        }
    }

    let autosaveIntervalId;
    function startAutosave() {
        const interval = (parseInt(elements.settings.autosaveInterval.value) || 30) * 1000;
        if (autosaveIntervalId) clearInterval(autosaveIntervalId);
        autosaveIntervalId = setInterval(() => { 
            if (!state.readOnlyMode) {
                saveState(); 
                showToast('Progreso guardado automáticamente.');
                logActivity('Autoguardado', 'El progreso de la sesión se guardó automáticamente.');
            }
        }, interval);
    }

    function checkReadOnlyMode() {
        if (state.readOnlyMode) {
            elements.readOnlyOverlay.classList.remove('hidden');
            
            document.querySelectorAll(`
                #upload-btn, #file-input, #create-user-btn, .edit-user-btn, 
                .delete-user-btn, .activate-user-btn, #ubicado-btn, #re-etiquetar-btn, 
                #add-note-btn, .inventory-item-checkbox, #select-all-checkbox, #add-adicional-btn, 
                .edit-adicional-btn, .delete-adicional-btn, #note-save-btn, #delete-photo-btn, 
                #photo-input, #use-camera-btn, #capture-photo-btn, .delete-list-btn, 
                #finalize-inventory-btn, #import-session-btn, #import-file-input, 
                #summary-area-responsible, #summary-location, #generate-summary-btn,
                #user-name, #user-location-select, #user-location-manual, #user-area-select,
                #adicional-form input, #adicional-form button, #edit-adicional-form input,
                .save-new-clave-btn, .new-clave-input, .report-btn
            `).forEach(el => {
                el.disabled = true;
                el.style.cursor = 'not-allowed';
                if (el.tagName === 'BUTTON' || el.tagName === 'LABEL') {
                    el.style.opacity = '0.6';
                }
            });
            
            elements.noteTextarea.readOnly = true;

        } else {
            elements.readOnlyOverlay.classList.add('hidden');
        }
    }


    function renderDashboard() {
        const totalItems = state.inventory.length;
        const locatedItems = state.inventory.filter(item => item.UBICADO === 'SI').length;
        const todayStr = new Date().toISOString().slice(0, 10);
        
        const dailyInventoryProgress = state.inventory.filter(item => item.fechaUbicado && item.fechaUbicado.startsWith(todayStr)).length;
        const dailyAdditionalProgress = state.additionalItems.filter(item => item.fechaRegistro && item.fechaRegistro.startsWith(todayStr)).length;
        const dailyTotal = dailyInventoryProgress + dailyAdditionalProgress;

        elements.totalItemsEl.textContent = totalItems;
        elements.locatedItemsEl.textContent = locatedItems;
        elements.pendingItemsEl.textContent = totalItems - locatedItems;
        elements.dailyProgressEl.textContent = dailyTotal;
        elements.workingAreasCountEl.textContent = new Set(state.inventory.map(item => item.areaOriginal)).size;
        elements.additionalItemsCountEl.textContent = state.additionalItems.length;
    }

    function changeTab(tabName) {
        elements.tabContents.forEach(tab => tab.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        
        const contentArea = elements.mainContentArea;
        contentArea.className = 'p-6 rounded-xl shadow-md glass-effect';
        contentArea.classList.add(`bg-tab-${tabName}`);

        logActivity('Navegación', `Se cambió a la pestaña: ${tabName}.`);

        if (tabName === 'inventory') {
            currentPage = 1;
            filterAndRenderInventory();
            setTimeout(() => elements.inventory.searchInput.focus(), 100);
        }
        if (tabName === 'users') renderUserList();
        if (tabName === 'reports') {
            renderReportStats();
            populateUserSelects();
            elements.reports.tableContainer.classList.add('hidden');
        }
        if (tabName === 'settings') {
            renderLoadedLists();
            renderDirectory();
        }
        if (tabName === 'adicionales') {
            populateAdicionalesFilters();
            renderAdicionalesList();
            setTimeout(() => document.getElementById('ad-clave').focus(), 100);
        }
    }

    function updateTheme(theme) {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        state.theme = theme;
        logActivity('Ajustes', `Tema cambiado a ${theme}.`);
    }

    function processFile(file) {
        if (state.readOnlyMode) return showToast('Modo de solo lectura: no se pueden cargar nuevos archivos.', 'warning');
        const fileName = file.name;

        const proceedWithUpload = () => {
            elements.loadingOverlay.overlay.classList.add('show');
            elements.dashboard.headerAndDashboard.classList.add('hidden');
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const tipoLibro = sheet['B7']?.v || sheet['L7']?.v || 'Sin Tipo';
                    addItemsFromFile(sheet, tipoLibro, fileName);
                } catch (error) {
                    console.error("Error processing file: ", error);
                    showToast('Error al procesar el archivo. Asegúrate de que el formato es correcto.', 'error');
                } finally {
                    elements.loadingOverlay.overlay.classList.remove('show');
                }
            };
            reader.onerror = () => {
                elements.loadingOverlay.overlay.classList.remove('show');
                showToast('Error al leer el archivo.', 'error');
            };
            reader.readAsBinaryString(file);
        };

        const isFileAlreadyLoaded = state.inventory.some(item => item.fileName === fileName);
        
        if (isFileAlreadyLoaded) {
            showConfirmationModal(
                'Archivo Duplicado',
                `El archivo "${fileName}" ya fue cargado. ¿Deseas reemplazar los datos existentes de este archivo con el nuevo?`,
                () => {
                    const itemsFromThisFile = state.inventory.filter(item => item.fileName === fileName).length;
                    logActivity('Archivo reemplazado', `Archivo "${fileName}" con ${itemsFromThisFile} bienes fue reemplazado.`);
                    state.inventory = state.inventory.filter(item => item.fileName !== fileName);
                    proceedWithUpload();
                }
            );
        } else {
            proceedWithUpload();
        }
    }
    
    function extractResponsibleInfo(sheet) {
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        const contentRows = data.filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));

        if (contentRows.length >= 2) {
            const nameRow = contentRows[contentRows.length - 2];
            const titleRow = contentRows[contentRows.length - 1];
            
            const name = nameRow.find(cell => cell !== null && String(cell).trim() !== '');
            const title = titleRow.find(cell => cell !== null && String(cell).trim() !== '');

            if (name && title && isNaN(name) && isNaN(title) && String(name).length > 3 && String(title).length > 3) {
                return { name: String(name).trim(), title: String(title).trim() };
            }
        }

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            for (let j = 0; j < row.length; j++) {
                if (String(row[j]).trim().toLowerCase() === 'responsable') {
                    if (i + 3 < data.length) {
                        const name = data[i + 2] ? String(data[i + 2][j] || '').trim() : null;
                        const title = data[i + 3] ? String(data[i + 3][j] || '').trim() : null;
                        if (name && title) return { name, title };
                    }
                }
            }
        }
        
        return null;
    }

    function addItemsFromFile(sheet, tipoLibro, fileName) {
        const areaString = sheet['A10']?.v || 'Sin Área';
        const area = areaString.match(/AREA\s(\d+)/)?.[1] || 'Sin Área';
        const listId = Date.now();
        
        if (area && !state.areaNames[area]) {
            state.areaNames[area] = areaString;
        }
        
        const responsible = extractResponsibleInfo(sheet);
        if (area && !state.areaDirectory[area]) {
            if (responsible) {
                state.areaDirectory[area] = {
                    fullName: areaString,
                    name: responsible.name,
                    title: responsible.title,
                };
            }
        }

        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 11 });
        const claveUnicaRegex = /^(?:\d{5,6}|0\.\d+)$/;

        const newItems = rawData.map(row => {
            const clave = String(row[0] || '').trim();
            if (!claveUnicaRegex.test(clave)) return null;

            return {
                'CLAVE UNICA': clave, 'DESCRIPCION': String(row[1] || ''), 'OFICIO': row[2] || '', 'TIPO': row[3] || '',
                'MARCA': row[4] || '', 'MODELO': row[5] || '', 'SERIE': row[6] || '', 'FECHA DE INICIO': row[7] || '',
                'REMISIÓN': row[8] || '', 'FECHA DE REMISIÓN': row[9] || '', 'FACTURA': row[10] || '', 'FECHA DE FACTURA': row[11] || '', 'AÑO': row[12] || '',
                'NOMBRE DE USUARIO': '', 'UBICADO': 'NO', 'IMPRIMIR ETIQUETA': 'NO',
                'listadoOriginal': tipoLibro, 'areaOriginal': area,
                'listId': listId, 'fileName': fileName
            };
        }).filter(Boolean); 

        state.inventory = state.inventory.concat(newItems);
        state.inventoryFinished = false; 
        
        logActivity('Archivo cargado', `Archivo "${fileName}" con ${newItems.length} bienes para el área ${area}. Tipo: ${tipoLibro}.`);

        const responsibleName = responsible?.name || 'No detectado';
        const toastMessage = `Área ${area}: Se cargaron ${newItems.length} bienes. Responsable: ${responsibleName}.`;
        showToast(toastMessage, 'success');

        saveState();
        renderDashboard();
        populateAreaSelects();
        populateUserSelects();
        populateBookTypeFilter();
        currentPage = 1;
        filterAndRenderInventory();
        renderLoadedLists();
        renderDirectory();
        updateSerialNumberCache();
    }

    function filterAndRenderInventory() {
        const searchTerm = elements.inventory.searchInput.value.trim().toLowerCase();
        const statusFilter = elements.inventory.statusFilter.value;
        const areaFilter = elements.inventory.areaFilter.value;
        const bookTypeFilter = elements.inventory.bookTypeFilter.value;

        filteredItems = state.inventory.filter(item =>
            (!searchTerm || [item['CLAVE UNICA'], item['DESCRIPCION'], item['MARCA'], item['MODELO'], item['SERIE']].some(f => String(f||'').toLowerCase().includes(searchTerm))) &&
            (statusFilter === 'all' || item.UBICADO === statusFilter) &&
            (areaFilter === 'all' || item.areaOriginal === areaFilter) &&
            (bookTypeFilter === 'all' || item.listadoOriginal === bookTypeFilter)
        );
        
        renderInventoryTable();

        if (/^\d{5,}/.test(searchTerm) && filteredItems.length === 1) {
            const itemKey = filteredItems[0]['CLAVE UNICA'];
            const row = document.querySelector(`tr[data-clave="${itemKey}"]`);
            if (row) {
                const checkbox = row.querySelector('.inventory-item-checkbox');
                if (checkbox && !checkbox.disabled) {
                    checkbox.checked = true;
                    showItemDetailView(itemKey);
                }
            }
        }

        const additionalResultsContainer = document.getElementById('additional-search-results-container');
        const additionalResultsList = document.getElementById('additional-search-results-list');

        if (!searchTerm) {
            additionalResultsContainer.classList.add('hidden');
            return;
        }

        const additionalMatches = state.additionalItems.filter(item =>
            (item.clave && String(item.clave).toLowerCase().includes(searchTerm)) ||
            (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm)) ||
            (item.marca && item.marca.toLowerCase().includes(searchTerm)) ||
            (item.modelo && item.modelo.toLowerCase().includes(searchTerm)) ||
            (item.serie && String(item.serie).toLowerCase().includes(searchTerm)) ||
            (item.claveAsignada && String(item.claveAsignada).toLowerCase().includes(searchTerm))
        );

        if (additionalMatches.length > 0) {
            additionalResultsList.innerHTML = additionalMatches.map(item => {
                const isPersonal = item.personal === 'Si';
                const itemClass = isPersonal ? 'personal-item' : 'additional-item';
                return `
                    <div class="flex items-center justify-between p-3 rounded-lg shadow-sm border-l-4 ${itemClass}">
                        <div>
                            <p class="font-semibold">${item.descripcion}</p>
                            <p class="text-sm opacity-80">Clave: ${item.clave || 'N/A'}, Serie: ${item.serie || 'N/A'}, Clave Asignada: ${item.claveAsignada || 'N/A'}</p>
                            <p class="text-xs opacity-70 mt-1">Asignado a: <strong>${item.usuario}</strong></p>
                        </div>
                        <i class="fa-solid fa-star text-purple-400" title="Bien Adicional"></i>
                    </div>
                `;
            }).join('');
            additionalResultsContainer.classList.remove('hidden');
        } else {
            additionalResultsContainer.classList.add('hidden');
        }
    }

    function highlightText(text, searchTerm) {
        if (!searchTerm.trim() || !text) {
            return text;
        }
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return String(text).replace(regex, `<mark class="bg-yellow-300 rounded-sm px-1">$1</mark>`);
    }

    function createInventoryRowElement(item) {
        const searchTerm = elements.inventory.searchInput.value.trim();
        const clave = item['CLAVE UNICA'] || '';
        const descripcion = item['DESCRIPCION'] || '';
        const marca = item['MARCA'] || '';
        const modelo = item['MODELO'] || '';
        const serie = item['SERIE'] || '';
        const usuario = item['NOMBRE DE USUARIO'] || '';

        const row = document.createElement('tr');
        let rowClasses = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer';
        if (state.notes[clave]) rowClasses += ' has-note';
        if (item.UBICADO === 'SI') rowClasses += ' item-located';
        row.className = rowClasses;
        row.dataset.clave = clave;
        
        const mismatchTag = item.areaIncorrecta ? `<span class="mismatched-area-tag" title="Ubicado en el área de otro listado">⚠️</span>` : '';
        
        const userData = state.resguardantes.find(u => u.name === usuario);
        const userDetails = userData 
            ? `${userData.name}\nÁrea: ${userData.area}\nUbicación: ${userData.locationWithId}` 
            : usuario;
        
        const truncate = (str, len) => (str && String(str).length > len ? String(str).substring(0, len) + '...' : str || '');

        row.innerHTML = `
            <td class="px-2 py-2"><input type="checkbox" class="inventory-item-checkbox rounded"></td>
            <td class="px-2 py-2 text-sm" title="${clave}">${highlightText(truncate(clave, 8), searchTerm)}</td>
            <td class="px-2 py-2 text-sm" title="${descripcion}">
                ${highlightText(truncate(descripcion, 30), searchTerm)}
                ${mismatchTag}
            </td>
            <td class="px-2 py-2 text-sm" title="${marca}">${highlightText(truncate(marca, 15), searchTerm)}</td>
            <td class="px-2 py-2 text-sm" title="${modelo}">${highlightText(truncate(modelo, 15), searchTerm)}</td>
            <td class="px-2 py-2 text-sm" title="${serie}">${highlightText(truncate(serie, 20), searchTerm)}</td>
            <td class="px-2 py-2 text-sm" title="${userDetails}">
                 ${highlightText(truncate(usuario, 20), searchTerm)}
            </td>
            <td class="px-2 py-2 text-sm">${item['UBICADO']}</td><td class="px-2 py-2 text-sm">${item['IMPRIMIR ETIQUETA']}</td>
            <td class="px-2 py-2 text-center">
                <div class="flex items-center justify-center space-x-3">
                    <i class="fa-solid fa-note-sticky text-xl ${state.notes[clave] ? 'text-yellow-500' : 'text-gray-400'} note-icon cursor-pointer" title="Añadir/Ver Nota"></i>
                    <i class="fa-solid fa-camera text-xl ${state.photos[clave] ? 'text-indigo-500' : 'text-gray-400'} camera-icon cursor-pointer" title="Añadir/Ver Foto"></i>
                    <i class="fa-solid fa-circle-info text-xl text-gray-400 hover:text-blue-500 md:hidden view-details-btn cursor-pointer" title="Ver Detalles"></i>
                    <i class="fa-solid fa-qrcode text-xl text-gray-400 hover:text-indigo-500 view-qr-btn cursor-pointer" title="Ver Código QR"></i>
                </div>
            </td>`;
        
        return row;
    }

    function renderInventoryTable() {
        const { tableBody, pageInfo, prevPageBtn, nextPageBtn } = elements.inventory;
        const fragment = document.createDocumentFragment();

        const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const itemsToRender = filteredItems.slice(start, end);

        if (itemsToRender.length === 0) {
            const emptyRow = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 12;
            cell.className = 'text-center py-4 text-gray-500';
            cell.textContent = 'No se encontraron bienes con los filtros actuales.';
            emptyRow.appendChild(cell);
            fragment.appendChild(emptyRow);
        } else {
            itemsToRender.forEach(item => {
                const rowElement = createInventoryRowElement(item);
                fragment.appendChild(rowElement);
            });
        }
        
        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);

        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    function handleInventoryActions(action) {
        if (state.readOnlyMode) return showToast('Modo de solo lectura: no se pueden realizar acciones.', 'warning');
        const selectedClaves = Array.from(document.querySelectorAll('.inventory-item-checkbox:checked')).map(cb => cb.closest('tr').dataset.clave);
        if (selectedClaves.length === 0) return showToast('Seleccione al menos un bien.', 'error');
        
        if (!state.activeResguardante) {
            return showToast('Debe activar un usuario para poder ubicar o re-etiquetar bienes.', 'error');
        }
        const activeUser = state.activeResguardante;
        const { searchInput } = elements.inventory;

        if (action === 'ubicar' || action === 're-etiquetar') {
            selectedClaves.forEach(clave => {
                const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
                if (!item) return;

                const isAssignedToOther = item.UBICADO === 'SI' && item['NOMBRE DE USUARIO'] && item['NOMBRE DE USUARIO'] !== activeUser.name;
                const assignAndProcess = () => {
                    assignItem(item, activeUser);
                    if (action === 're-etiquetar') {
                        item['IMPRIMIR ETIQUETA'] = 'SI';
                        logActivity('Bien marcado para re-etiquetar', `Clave: ${clave}, Usuario: ${activeUser.name}`);
                    } else {
                        logActivity('Bien ubicado', `Clave: ${clave}, Usuario: ${activeUser.name}`);
                    }
                };

                if (isAssignedToOther) {
                    showConfirmationModal('Reasignar Bien', `El bien ${clave} ya está asignado a ${item['NOMBRE DE USUARIO']}. ¿Deseas reasignarlo a ${activeUser.name}?`, () => {
                        logActivity('Bien reasignado', `Clave: ${clave} de ${item['NOMBRE DE USUARIO']} a ${activeUser.name}`);
                        assignAndProcess();
                        showToast(`Bien ${clave} reasignado a ${activeUser.name}.`);
                        filterAndRenderInventory(); renderDashboard(); saveState();
                    });
                } else {
                    assignAndProcess();
                }
            });
            const message = action === 'ubicar' ? `Se ubicaron ${selectedClaves.length} bienes.` : `Se marcaron ${selectedClaves.length} bienes para re-etiquetar y fueron ubicados.`;
            showToast(message);
            searchInput.value = '';
            searchInput.focus();
            filterAndRenderInventory(); renderDashboard(); saveState();
        }
    }

    function assignItem(item, user) {
        item.UBICADO = 'SI';
        item['NOMBRE DE USUARIO'] = user.name;
        item.fechaUbicado = new Date().toISOString();
        item.areaIncorrecta = item.areaOriginal !== user.area;

        checkAreaCompletion(item.areaOriginal);
        checkInventoryCompletion();
    }

    function checkInventoryCompletion() {
        if (state.inventoryFinished || state.inventory.length === 0) return;

        const allLocated = state.inventory.every(item => item.UBICADO === 'SI');
        if (allLocated) {
            state.inventoryFinished = true;
            logActivity('Inventario completado', 'Todos los bienes han sido ubicados.');
            showConfirmationModal(
                '¡Inventario Completado!',
                '¡Felicidades! Has ubicado todos los bienes. ¿Deseas generar el Resumen de Sesión y el Plan de Acción?',
                () => { 
                    showPreprintModal('session_summary');
                }
            );
            saveState();
        }
    }
    
    function checkAreaCompletion(areaId) {
        if (!areaId || state.closedAreas[areaId]) {
            return; 
        }

        const areaItems = state.inventory.filter(item => item.areaOriginal === areaId);
        const isAreaComplete = areaItems.length > 0 && areaItems.every(item => item.UBICADO === 'SI');

        if (isAreaComplete) {
            logActivity('Área completada', `Todos los bienes del área ${areaId} han sido ubicados.`);
            showAreaClosureModal(areaId);
        }
    }

    function renderUserList() {
        const list = elements.userForm.list;
        const searchInput = document.getElementById('user-search-input');
        const userCountBadge = document.getElementById('user-count-badge');
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const filteredUsers = state.resguardantes.filter(user => {
            if (!searchTerm) return true;
            return (
                user.name.toLowerCase().includes(searchTerm) ||
                user.locationWithId.toLowerCase().includes(searchTerm) ||
                String(user.area).toLowerCase().includes(searchTerm)
            );
        });
        
        if (userCountBadge) {
            userCountBadge.textContent = `${filteredUsers.length} de ${state.resguardantes.length} Total`;
        }

        list.innerHTML = filteredUsers.length === 0 
            ? `<p class="text-gray-500">No se encontraron usuarios.</p>` 
            : '';
            
        filteredUsers.forEach((user) => {
            const originalIndex = state.resguardantes.findIndex(u => u.id === user.id);
            const isActive = state.activeResguardante?.id === user.id;
            const item = document.createElement('div');
            item.className = `flex items-center justify-between p-2 rounded-lg shadow-sm transition-colors ${isActive ? 'active-user border-l-4 border-green-500' : 'non-active-user'}`;
            
            const hasLocationPhoto = state.locationPhotos && state.locationPhotos[user.locationWithId];
            const photoIconColor = hasLocationPhoto ? 'text-indigo-500' : 'text-gray-400';

            item.innerHTML = `
                <div class="flex-grow">
                   <p class="font-semibold">${user.name}</p>
                   <p class="text-sm text-gray-500 dark:text-gray-400">${user.locationWithId} - Área ${user.area}</p>
                </div>
                <div class="space-x-2 flex items-center">
                    <i class="fa-solid fa-camera text-xl ${photoIconColor} cursor-pointer location-photo-btn" data-location-id="${user.locationWithId}" title="Gestionar foto de la ubicación"></i>
                    <button data-index="${originalIndex}" class="activate-user-btn px-3 py-1 rounded-lg text-xs font-bold transition-colors ${isActive ? 'text-white bg-green-600' : 'text-gray-700 bg-gray-200 hover:bg-gray-300'}">${isActive ? 'Activo' : 'Activar'}</button>
                    <button data-index="${originalIndex}" class="edit-user-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600">Editar</button>
                    <button data-index="${originalIndex}" class="delete-user-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600">Eliminar</button>
                </div>`;
            list.appendChild(item);
        });
    }

    function renderAdicionalesList() {
        const listEl = elements.adicionales.list;
        const filterUser = elements.adicionales.userFilter.value;
        const filterArea = elements.adicionales.areaFilter.value;
        
        let filtered = state.additionalItems;

        if (filterArea && filterArea !== 'all') {
            const usersInArea = state.resguardantes
                .filter(user => user.area === filterArea)
                .map(user => user.name);
            filtered = filtered.filter(item => usersInArea.includes(item.usuario));
        }

        if (filterUser && filterUser !== 'all') {
            filtered = filtered.filter(item => item.usuario === filterUser);
        }
        
        elements.adicionales.total.textContent = `${filtered.length} de ${state.additionalItems.length} Total`;

        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="text-gray-500">No hay bienes adicionales con los filtros seleccionados.</p>';
            return;
        }

        listEl.innerHTML = filtered.map((item, index) => {
            const isPersonal = item.personal === 'Si';
            const itemClass = isPersonal ? 'personal-item' : 'additional-item';
            
            let personalTag = '';
            if (isPersonal) {
                if (item.tieneFormatoEntrada === true) {
                    personalTag = `<span class="font-bold text-xs ml-2" title="Tiene formato de entrada"><i class="fa-solid fa-file-circle-check text-green-600"></i> (Personal)</span>`;
                } else if (item.tieneFormatoEntrada === false) {
                    personalTag = `<span class="font-bold text-xs ml-2" title="No tiene formato de entrada"><i class="fa-solid fa-file-circle-exclamation text-amber-600"></i> (Personal)</span>`;
                } else {
                    personalTag = `<span class="font-bold text-xs ml-2">(Personal)</span>`;
                }
            }

            const hasPhoto = state.additionalPhotos[item.id];

            return `<div class="flex items-center justify-between p-3 rounded-lg shadow-sm border-l-4 ${itemClass}">
                <div class="flex items-center">
                    <span class="font-bold text-lg mr-3">${index + 1}.</span>
                    <div>
                        <p class="font-semibold">${item.descripcion}${personalTag}</p>
                        <p class="text-sm opacity-80">Clave: ${item.clave || 'N/A'}, Marca: ${item.marca || 'N/A'}, Serie: ${item.serie || 'N/A'}</p>
                        <p class="text-sm opacity-70">Usuario: ${item.usuario}</p>
                    </div>
                </div>
                <div class="space-x-2">
                    <button data-id="${item.id}" class="adicional-photo-btn action-btn ${hasPhoto ? 'text-indigo-500' : ''}"><i class="fa-solid fa-camera"></i></button>
                    <button data-id="${item.id}" class="edit-adicional-btn action-btn"><i class="fa-solid fa-pencil"></i></button>
                    <button data-id="${item.id}" class="delete-adicional-btn action-btn"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`
        }).join('');
    }
    
    function showEditAdicionalModal(id) {
        if (state.readOnlyMode) return;
        const item = state.additionalItems.find(i => i.id === id);
        if (!item) return;

        const { modal, form, saveBtn } = elements.editAdicionalModal;
        form.elements['clave'].value = item.clave || '';
        form.elements['descripcion'].value = item.descripcion || '';
        form.elements['marca'].value = item.marca || '';
        form.elements['modelo'].value = item.modelo || '';
        form.elements['serie'].value = item.serie || '';
        form.elements['area'].value = item.area || '';
        form.elements['personal'].value = item.personal || 'No';
        
        saveBtn.dataset.id = id;
        modal.classList.add('show');
    }

    function updateDetailViewPhoto(clave) {
        const { detailView } = elements;
        
        detailView.photo.classList.add('hidden');
        detailView.noPhoto.classList.remove('hidden');
        detailView.photo.src = ''; 

        if (state.photos[clave]) {
            photoDB.getItem(`inventory-${clave}`).then(imageBlob => {
                if (imageBlob) {
                    const objectURL = URL.createObjectURL(imageBlob);
                    detailView.photo.src = objectURL;
                    detailView.photo.onload = () => URL.revokeObjectURL(objectURL);
                    detailView.photo.classList.remove('hidden');
                    detailView.noPhoto.classList.add('hidden');
                }
            }).catch(() => {
                detailView.photo.classList.add('hidden');
                detailView.noPhoto.classList.remove('hidden');
                detailView.photo.src = '';
            });
        }
    }

    function showPhotoModal(type, id) {
        const { modal, title, input, deleteBtn, viewContainer, uploadContainer, cameraViewContainer, img } = elements.photo;
        
        let modalTitle = 'Foto del Bien';
        if (type === 'location') modalTitle = `Foto de la Ubicación: ${id}`;
        title.textContent = modalTitle;

        input.dataset.type = type;
        input.dataset.id = id;
        deleteBtn.dataset.type = type;
        deleteBtn.dataset.id = id;
        
        let photoExists = false;
        if (type === 'inventory') photoExists = state.photos[id];
        else if (type === 'additional') photoExists = state.additionalPhotos[id];
        else if (type === 'location') photoExists = state.locationPhotos[id];
        
        viewContainer.classList.add('hidden');
        uploadContainer.classList.add('hidden');
        cameraViewContainer.classList.add('hidden');
        stopCamera();

        if (photoExists) {
            viewContainer.classList.remove('hidden');
            photoDB.getItem(`${type}-${id}`).then(imageBlob => {
                if (imageBlob) {
                    const objectURL = URL.createObjectURL(imageBlob);
                    img.src = objectURL;
                    img.onload = () => URL.revokeObjectURL(objectURL);
                } else {
                    img.src = '';
                    img.alt = 'Error al cargar la imagen desde la base de datos.';
                }
            }).catch(() => {
                img.src = '';
                img.alt = 'Error al cargar la imagen.';
            });
        } else {
            if (!state.readOnlyMode) {
                uploadContainer.classList.remove('hidden');
            }
        }
        
        modal.classList.add('show');
    }
    
    function showItemDetailsModal(clave) {
         const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
         if (!item) return;

         const { modal, title, content } = elements.itemDetailsModal;
         title.textContent = `Detalles: ${item['CLAVE UNICA']}`;
         
         const userData = state.resguardantes.find(u => u.name === item['NOMBRE DE USUARIO']);
         const userDetails = userData 
            ? `<strong>Usuario:</strong> ${userData.name}<br>
               <strong>Área:</strong> ${userData.area}<br>
               <strong>Ubicación:</strong> ${userData.locationWithId}`
            : `<strong>Usuario:</strong> ${item['NOMBRE DE USUARIO'] || 'No asignado'}`;

         content.innerHTML = `
            <p><strong>Descripción:</strong> ${item.DESCRIPCION || 'N/A'}</p>
            <p><strong>Marca:</strong> ${item.MARCA || 'N/A'}</p>
            <p><strong>Modelo:</strong> ${item.MODELO || 'N/A'}</p>
            <p><strong>Serie:</strong> ${item.SERIE || 'N/A'}</p>
            <hr class="my-2">
            <p>${userDetails}</p>
         `;
         modal.classList.add('show');
    }

    function showItemDetailView(clave) {
        const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
        if (!item) return;

        const { detailView } = elements;
        const areaName = state.areaNames[item.areaOriginal] || `Área ${item.areaOriginal}`;

        detailView.clave.textContent = item['CLAVE UNICA'];
        detailView.descripcion.textContent = item['DESCRIPCION'] || 'N/A';
        detailView.marca.textContent = item['MARCA'] || 'N/A';
        detailView.modelo.textContent = item['MODELO'] || 'N/A';
        detailView.serie.textContent = item['SERIE'] || 'N/A';
        detailView.usuario.textContent = item['NOMBRE DE USUARIO'] || 'Sin Asignar';
        detailView.area.textContent = areaName;
        
        const warningContainer = detailView.areaWarning;
        warningContainer.innerHTML = '';
        warningContainer.className = 'mt-3 p-3 rounded-lg text-sm hidden';

        const activeUser = state.activeResguardante;
        if (activeUser && item.areaOriginal !== activeUser.area) {
            warningContainer.classList.remove('hidden');
            warningContainer.classList.add('bg-yellow-100', 'dark:bg-yellow-900/50', 'text-yellow-800', 'dark:text-yellow-200');
            warningContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i><strong>Aviso:</strong> Este bien pertenece al <strong>área ${item.areaOriginal}</strong>, pero el usuario activo está en el <strong>área ${activeUser.area}</strong>.`;
        } else if (!activeUser) {
            warningContainer.classList.remove('hidden');
            warningContainer.classList.add('bg-blue-100', 'dark:bg-blue-900/50', 'text-blue-800', 'dark:text-blue-200');
            warningContainer.innerHTML = `<i class="fa-solid fa-info-circle mr-2"></i>Para ubicar este bien, primero activa un usuario en la pestaña "Usuarios".`;
        }


        updateDetailViewPhoto(clave);

        const closeModal = () => detailView.modal.classList.remove('show');

        const ubicarHandler = () => {
            if (!state.activeResguardante) return showToast('Activa un usuario para poder ubicar.', 'error');
            const checkbox = document.querySelector(`tr[data-clave="${clave}"] .inventory-item-checkbox`);
            if(checkbox) checkbox.checked = true;
            handleInventoryActions('ubicar');
            if(checkbox) checkbox.checked = false;
            closeModal();
        };

        const reetiquetarHandler = () => {
             if (!state.activeResguardante) return showToast('Activa un usuario para poder re-etiquetar.', 'error');
            const checkbox = document.querySelector(`tr[data-clave="${clave}"] .inventory-item-checkbox`);
            if(checkbox) checkbox.checked = true;
            handleInventoryActions('re-etiquetar');
            if(checkbox) checkbox.checked = false;
            closeModal();
        };

        const notaHandler = () => { showNotesModal(clave); };
        const fotoHandler = () => { showPhotoModal('inventory', clave); };
        
        detailView.ubicarBtn.onclick = ubicarHandler;
        detailView.reetiquetarBtn.onclick = reetiquetarHandler;
        detailView.notaBtn.onclick = notaHandler;
        detailView.fotoBtn.onclick = fotoHandler;

        detailView.modal.classList.add('show');
    }

    function showNotesModal(clave) {
        const selectedClaves = clave ? [clave] : Array.from(document.querySelectorAll('.inventory-item-checkbox:checked')).map(cb => cb.closest('tr').dataset.clave);
        if (selectedClaves.length === 0) {
            if(!clave) return showToast('Seleccione al menos un bien.', 'error');
            return;
        }

        if (selectedClaves.length > 1) {
            elements.noteTextarea.value = '';
            elements.noteTextarea.placeholder = `Añadir una nota a los ${selectedClaves.length} bienes seleccionados...`;
        } else {
            elements.noteTextarea.value = state.notes[selectedClaves[0]] || '';
            elements.noteTextarea.placeholder = 'Escribe tu nota aquí...';
        }

        elements.noteSaveBtn.dataset.claves = JSON.stringify(selectedClaves);
        elements.notesModal.classList.add('show');
    }

    function showQrModal(clave) {
        const { modal, container, title } = elements.qrDisplayModal;
        container.innerHTML = '';
        title.textContent = `Código QR del Bien: ${clave}`;
        new QRCode(container, {
            text: clave,
            width: 200,
            height: 200,
            correctLevel: QRCode.CorrectLevel.H
        });
        modal.classList.add('show');
    }

    function showEditUserModal(index) {
        if (state.readOnlyMode) return;
        const user = state.resguardantes[index];
        elements.editUserModal.querySelector('#edit-user-name').value = user.name;
        elements.editUserModal.querySelector('#edit-user-location').value = user.locationWithId;
        elements.editUserAreaSelect.value = user.area;
        elements.editUserSaveBtn.dataset.userIndex = index;
        elements.editUserModal.classList.add('show');
    }
    
    function showAreaClosureModal(areaId) {
        if (state.readOnlyMode) return;
        const { modal, title, responsibleInput, locationInput, confirmBtn, cancelBtn } = elements.areaClosure;
        const areaFullName = state.areaNames[areaId] || `Área ${areaId}`;

        title.textContent = `Cerrar Acta de Inventario: ${areaFullName}`;
        responsibleInput.value = state.areaDirectory[areaId]?.name || '';
        locationInput.value = '';
        modal.classList.add('show');

        const confirmHandler = () => {
            const responsible = responsibleInput.value.trim();
            const location = locationInput.value.trim();

            if (!responsible || !location) {
                return showToast('Ambos campos son obligatorios.', 'error');
            }
            
            state.closedAreas[areaId] = { responsible, location, date: new Date().toISOString() };
            logActivity('Acta de área cerrada', `Área: ${areaId}, Responsable que recibe: ${responsible}`);
            saveState();
            renderLoadedLists();
            
            showPreprintModal('area_closure', { areaId, responsible, location });
            closeModal();
        };
        
        const closeModal = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', closeModal);
        };

        confirmBtn.addEventListener('click', confirmHandler, { once: true });
        cancelBtn.addEventListener('click', closeModal, { once: true });
    }

    async function startQrScanner() {
        if (state.readOnlyMode) return;
        elements.qrScannerModal.classList.add('show');
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop();
        }
        html5QrCode = new Html5Qrcode("qr-reader");

        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            stopQrScanner();
            elements.inventory.searchInput.value = decodedText;
            currentPage = 1;
            filterAndRenderInventory();
            showToast(`Bien con clave ${decodedText} encontrado.`);
            logActivity('Escaneo QR', `Se encontró la clave: ${decodedText}.`);
            changeTab('inventory');
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const cameraConfig = { facingMode: "environment" };
        
        html5QrCode.start(
            cameraConfig, // Usar objeto de configuración de cámara
            config,
            qrCodeSuccessCallback
        ).catch(err => {
            showToast('Error al iniciar la cámara trasera. Revisa los permisos.', 'error');
            console.error("Error al iniciar el escaner QR: ", err);
            stopQrScanner();
        });
    }

    function stopQrScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(ignore => {
                elements.qrScannerModal.classList.remove('show');
            }).catch(err => {
                elements.qrScannerModal.classList.remove('show');
            });
        } else {
            elements.qrScannerModal.classList.remove('show');
        }
    }

     function populateAdicionalesFilters() {
        const areaSelect = elements.adicionales.areaFilter;
        const userSelect = elements.adicionales.userFilter;
        const selectedArea = areaSelect.value;
        
        areaSelect.innerHTML = '<option value="all">Todas las áreas</option>' + 
            state.areas.map(area => `<option value="${area}" ${selectedArea === area ? 'selected' : ''}>${area}</option>`).join('');
        
        let usersToList = state.resguardantes;
        if (selectedArea !== 'all') {
            usersToList = usersToList.filter(user => user.area === selectedArea);
        }

        const selectedUser = userSelect.value;

        userSelect.innerHTML = '<option value="all">Todos los usuarios</option>' +
            usersToList.map(user => `<option value="${user.name}" ${selectedUser === user.name ? 'selected' : ''}>${user.name}</option>`).join('');
    }

    function populateAreaSelects() {
        const areasFromInventory = state.inventory.map(item => item.areaOriginal);
        const areasFromUsers = state.resguardantes.map(user => user.area);
        const persistentAreas = state.persistentAreas || [];
        state.areas = [...new Set([...areasFromInventory, ...areasFromUsers, ...persistentAreas])].filter(Boolean).sort();

        [elements.userForm.areaSelect, elements.reports.areaFilter, elements.inventory.areaFilter, elements.editUserAreaSelect, elements.adicionales.areaFilter].forEach(select => {
            const selectedValue = select.value;
            const firstOpt = select.id.includes('user-area-select') ? '<option value="">Seleccione</option>' : '<option value="all">Todas</option>';
            select.innerHTML = firstOpt + state.areas.map(area => `<option value="${area}" ${selectedValue === area ? 'selected' : ''}>${area}</option>`).join('');
            if (selectedValue && !select.querySelector(`option[value="${selectedValue}"]`)) {
                select.value = 'all'; 
            }
        });
    }
    
    function populateUserSelects() {
        const userSelects = [elements.reports.userFilter, elements.adicionales.userFilter];
        const users = state.resguardantes.map(u => u.name).sort();

        userSelects.forEach(select => {
            const selectedValue = select.value;
            select.innerHTML = '<option value="all">Todos los usuarios</option>' + 
                               users.map(user => `<option value="${user}">${user}</option>`).join('');
            if (selectedValue && select.querySelector(`option[value="${selectedValue}"]`)) {
                select.value = selectedValue;
            }
        });
    }

    function populateBookTypeFilter() {
        const bookTypes = [...new Set(state.inventory.map(item => item.listadoOriginal))].filter(Boolean).sort();
        const select = elements.inventory.bookTypeFilter;
        const staticOptions = Array.from(select.querySelectorAll('option[value]:not([value="all"])')).map(opt => opt.value);
        const allTypes = [...new Set([...staticOptions, ...bookTypes])].sort();
        
        select.innerHTML = '<option value="all">Todos los tipos</option>' + 
            allTypes.map(type => `<option value="${type}">${type}</option>`).join('');
    }
    
    function exportLabelsToXLSX() {
        const itemsToLabel = state.inventory.filter(item => item['IMPRIMIR ETIQUETA'] === 'SI');
        const additionalItemsToLabel = state.additionalItems.filter(item => item.claveAsignada);

        if (itemsToLabel.length === 0 && additionalItemsToLabel.length === 0) {
            return showToast('No hay bienes marcados para etiquetar.', 'info');
        }
        
        showToast('Generando reporte de etiquetas XLSX...');
        logActivity('Exportación XLSX', `Exportando ${itemsToLabel.length} etiquetas de inventario y ${additionalItemsToLabel.length} de adicionales.`);

        try {
            const inventoryData = itemsToLabel.map(item => {
                const claveUnica = String(item['CLAVE UNICA']);
                return {
                    'Clave única': claveUnica.startsWith('0.') ? claveUnica.substring(1) : claveUnica,
                    'Descripción': item['DESCRIPCION'],
                    'Usuario': item['NOMBRE DE USUARIO'] || 'Sin Asignar',
                    'Área': state.resguardantes.find(u => u.name === item['NOMBRE DE USUARIO'])?.area || 'N/A'
                };
            });

            const additionalData = additionalItemsToLabel.map(item => {
                 return {
                    'Clave única': item.claveAsignada,
                    'Descripción': item.descripcion,
                    'Usuario': item.usuario || 'Sin Asignar',
                    'Área': state.resguardantes.find(u => u.name === item.usuario)?.area || 'N/A'
                };
            });

            const combinedData = [...inventoryData, ...additionalData];

            const worksheet = XLSX.utils.json_to_sheet(combinedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Etiquetas");

            worksheet['!cols'] = [
                { wch: 15 }, { wch: 50 }, { wch: 30 }, { wch: 15 }
            ];

            XLSX.writeFile(workbook, "reporte_etiquetas_combinado.xlsx");
            showToast('Reporte de etiquetas generado con éxito.', 'success');
        } catch (error) {
            console.error("Error generating labels XLSX file:", error);
            showToast('Hubo un error al generar el reporte de etiquetas.', 'error');
        }
    }

    function getDetailedStats() {
        const stats = {};
        const groupBy = (arr, key) => arr.reduce((acc, item) => {
            (acc[item[key]] = acc[item[key]] || []).push(item);
            return acc;
        }, {});

        stats.pendingByArea = groupBy(state.inventory.filter(i => i.UBICADO === 'NO'), 'areaOriginal');
        stats.assignedByUser = groupBy(state.inventory.filter(i => i.UBICADO === 'SI'), 'NOMBRE DE USUARIO');
        const pendingLabels = state.inventory.filter(i => i['IMPRIMIR ETIQUETA'] === 'SI');
        stats.labelsByArea = groupBy(pendingLabels, 'areaOriginal');
        stats.labelsByUser = groupBy(pendingLabels, 'NOMBRE DE USUARIO');
        stats.additionalCount = state.additionalItems.length;

        return stats;
    }
    
    function renderReportStats() {
        const stats = getDetailedStats();
        
        let html = `<p class="font-bold">Bienes Adicionales Registrados: <span class="font-normal">${stats.additionalCount}</span></p><hr class="my-2 border-gray-300 dark:border-gray-600">`;

        const generateHtmlList = (title, data) => {
            let listHtml = `<div class="mb-2"><p class="font-bold">${title}</p>`;
            const entries = Object.entries(data);
            if (entries.length === 0) {
                listHtml += `<p class="text-gray-500 text-xs">No hay datos.</p></div>`;
                return listHtml;
            }
            listHtml += '<ul class="list-disc list-inside">';
            entries.forEach(([key, value]) => {
                listHtml += `<li><strong>${key || 'Sin Asignar'}:</strong> ${value.length}</li>`;
            });
            listHtml += '</ul></div>';
            return listHtml;
        };

        html += generateHtmlList('Bienes Asignados por Usuario:', stats.assignedByUser);
        html += '<hr class="my-2 border-gray-300 dark:border-gray-600">';
        html += generateHtmlList('Bienes Pendientes por Área:', stats.pendingByArea);
        html += '<hr class="my-2 border-gray-300 dark:border-gray-600">';
        html += generateHtmlList('Etiquetas Pendientes por Usuario:', stats.labelsByUser);
        html += '<hr class="my-2 border-gray-300 dark:border-gray-600">';
        html += generateHtmlList('Etiquetas Pendientes por Área:', stats.labelsByArea);

        elements.reports.stats.innerHTML = html;
    }
    function generateSimplePendingReport(options = {}) {
        const { areaDisplay = 'Todas las Áreas', entrega, recibe } = options;
        const selectedArea = elements.reports.areaFilter.value;
        let pendingItems = state.inventory.filter(item => item.UBICADO === 'NO');

        if (selectedArea !== 'all') {
            pendingItems = pendingItems.filter(item => item.areaOriginal === selectedArea);
        }

        if (pendingItems.length === 0) {
            return showToast('No hay bienes pendientes para los filtros seleccionados.', 'info');
        }
        
        logActivity('Reporte Impreso', `Impresión de reporte de ${pendingItems.length} pendientes.`);

        const printWindow = window.open('', '_blank');

        printWindow.document.write('<html><head><title>Reporte de Bienes Pendientes</title>');
        printWindow.document.write(`<style>
            body { font-family: sans-serif; font-size: 10px; margin: 0.5in; }
            .header { display: flex; align-items: center; text-align: left; margin-bottom: 1em; padding-bottom: 0.5em; border-bottom: 2px solid #ccc; }
            .header-logo { max-height: 50px; max-width: 150px; }
            .header-titles { text-align: center; flex-grow: 1; margin-left: auto; margin-right: auto; }
            .header-titles h1 { margin: 0; font-size: 1.3em; font-weight: bold; }
            .header-titles h2 { margin: 0; font-size: 0.9em; font-weight: normal; color: #555; }
            .header-area { margin: 0; font-size: 0.9em; font-weight: normal; color: #555; text-align: center; margin-top: 5px; } 
            .current-date { font-size: 0.9em; align-self: flex-start; text-align: right; margin-left: 20px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 10px; }
            td, th { border: 1px solid #ccc; padding: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.7em; } 
            th { background-color: #f2f2f2; border-bottom: 2px solid #999; }
            .num-cell { width: 4%; text-align: center; } .clave-cell { width: 10%; } .desc-cell { width: 38%; }
            .marca-cell, .modelo-cell { width: 12%; } .serie-cell { width: 14%; } .area-cell { width: 10%; }
            .signature-box { text-align: center; width: 45%; margin-top: 50px; display: inline-block; }
            .signatures { display: flex; justify-content: space-around; margin-top: 80px; }
            .signature-line { border-bottom: 1px solid #000; margin-bottom: 0.5em; }
        </style></head><body>`);
        
        const logoSrc = 'logo.png';
        printWindow.document.write('<div class="header">');
        printWindow.document.write(`<div><img src="${logoSrc}" alt="Logo" class="header-logo"></div>`);
        
        printWindow.document.write('<div class="header-titles">');
        printWindow.document.write('<h1>REPORTE DE BIENES PENDIENTES</h1>');
        printWindow.document.write(`<h2>Dirección de Almacén e Inventarios</h2>`);
        printWindow.document.write(`<div class="header-area">${areaDisplay}</div>`); 
        printWindow.document.write('</div>');

        printWindow.document.write(`<div class="current-date">Fecha: ${new Date().toLocaleDateString('es-MX')}</div></div>`);
        
        printWindow.document.write(`<table><thead><tr>
            <th class="num-cell">#</th> <th class="clave-cell">Clave</th> <th class="desc-cell">Descripción</th>
            <th class="marca-cell">Marca</th> <th class="modelo-cell">Modelo</th> <th class="serie-cell">Serie</th>
            <th class="area-cell">Área Original</th>
        </tr></thead><tbody>`);

        pendingItems.forEach((item, index) => {
            const truncate = (str, len) => (str && String(str).length > len ? String(str).substring(0, len) + '...' : str || '');
            printWindow.document.write(`<tr>
                <td class="num-cell">${index + 1}</td>
                <td class="clave-cell">${item['CLAVE UNICA']}</td>
                <td class="desc-cell" title="${item['DESCRIPCION'] || ''}">${truncate(item['DESCRIPCION'], 40)}</td>
                <td class="marca-cell">${item['MARCA'] || ''}</td>
                <td class="modelo-cell">${item['MODELO'] || ''}</td>
                <td class="serie-cell">${item['SERIE'] || ''}</td>
                <td class="area-cell">${item.areaOriginal || ''}</td>
            </tr>`);
        });
        printWindow.document.write('</tbody></table>');

        printWindow.document.write(`<div class="signatures">
            <div class="signature-box"><p class="signature-line"></p><strong>${entrega}</strong><br>Realizó Inventario</div>
            <div class="signature-box"><p class="signature-line"></p><strong>${recibe}</strong><br>Recibe Copia de Pendientes</div>
        </div>`);

        printWindow.document.write('</body></html>');
        
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }

    function generatePrintableResguardo(title, user, items, isAdicional = false, options = {}) {
        const {
            areaFullName = 'Área no especificada',
            entrega,
            recibe,
            recibeCargo
        } = options;

         if (!user || user === 'all') {
            return showToast('Por favor, selecciona un usuario o área para generar el informe.', 'error');
        }
        if (items.length === 0) {
            return showToast(`No se encontraron bienes para el filtro seleccionado.`, 'error');
        }
        
        logActivity('Resguardo Impreso', `Resguardo para ${user} con ${items.length} bienes.`);
        
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write('<html><head><title>Resguardo de Bienes</title>');
        printWindow.document.write(`<style>
                body { font-family: sans-serif; margin: 2em; }
                .header { display: flex; justify-content: space-between; align-items: center; text-align: left; margin-bottom: 1.5em; padding-bottom: 0.5em; border-bottom: 2px solid #ccc; }
                .header-logo { max-height: 50px; max-width: 150px; }
                .header-titles { text-align: center; flex-grow: 1; }
                .header-titles p { margin: 0; font-size: 0.9em; color: #555; }
                .header-titles h1 { margin: 0; font-size: 1.3em; font-weight: bold; }
                .header-titles h2 { margin: 0; font-size: 0.9em; font-weight: normal; color: #555; }
                .header-date { font-size: 0.9em; text-align: right; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ccc; padding: 5px; text-align: left; font-size: 0.7em; } 
                th { background-color: #f2f2f2; border-bottom: 2px solid #999; }
                .main-text { text-align: justify; border-bottom: 1px dashed #ccc; padding-bottom: 15px; margin-bottom: 20px;}
                .signatures { display: flex; justify-content: space-around; margin-top: 80px; }
                .signature-box { text-align: center; width: 45%; }
                .signature-line { border-bottom: 1px solid #000; margin-bottom: 0.5em; }
                .footer-count { text-align: right; font-weight: bold; margin-top: 1em; }
            </style>`);            
        printWindow.document.write('</head><body>');
        
        const logoSrc = 'logo.png';
        printWindow.document.write('<div class="header">');
        printWindow.document.write(`<div><img src="${logoSrc}" alt="Logo" class="header-logo"></div>`);
        
        printWindow.document.write('<div class="header-titles">');
        printWindow.document.write(`<h1>${title}</h1>`);
        printWindow.document.write(`<p>Dirección de Almacén e Inventarios</p>`);
        printWindow.document.write(`<h2>${areaFullName}</h2>`);
        printWindow.document.write('</div>');

        const today = new Date();
        const dateFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        printWindow.document.write(`<div class="header-date">${dateFormatted}</div>`);
        printWindow.document.write('</div>');

        const responsibleName = (isAdicional) ? areaFullName : user;
        const introText = isAdicional 
            ? `Por medio de la presente, se hace constar que <strong>${responsibleName}</strong> cuenta con los siguientes bienes adicionales:`
            : `Quedo enterado, yo <strong>${user}</strong> que los Bienes Muebles que se encuentran listados en el presente resguardo, están a partir de la firma del mismo, bajo mi buen uso, custodia, vigilancia y conservación, en caso de daño, robo o extravio, se deberá notificar de inmediato a el Área Administrativa o Comisión para realizar el trámite administrativo correspondiente, por ningún motivo se podra cambiar o intercambiar los bienes sin previa solicitud y autorización de el Área Administrativa o Comisión.`;

        printWindow.document.write(`<p class="main-text">${introText}</p>`);
        
        const headers = isAdicional 
            ? ['#', 'Descripción', 'Marca', 'Serie', 'Usuario', 'Personal'] 
            : ['#', 'Clave', 'Descripción', 'Marca', 'Serie', 'Área Original'];
        printWindow.document.write(`<table><thead><tr><th>${headers.join('</th><th>')}</th></tr></thead><tbody>`);

        const truncate = (str, len) => (str && str.length > len ? str.substring(0, len) + '...' : str || '');

        items.forEach((item, index) => {
            const desc = truncate(String(item.descripcion || item.DESCRIPCION || ''), 40);
            const rowData = isAdicional 
                ? `<td>${index+1}</td><td>${desc}</td><td>${item.marca || 'N/A'}</td><td>${item.serie || 'N/A'}</td><td>${item.usuario}</td><td>${item.personal}</td>` 
                : `<td>${index+1}</td><td>${item['CLAVE UNICA']}</td><td>${desc}</td><td>${item['MARCA']}</td><td>${item['SERIE']}</td><td>${item.areaOriginal}</td>`;
            printWindow.document.write(`<tr>${rowData}</tr>`);
        });
        printWindow.document.write('</tbody></table>');
        printWindow.document.write(`<p class="footer-count">Total de Bienes: ${items.length}</p>`);
        
        printWindow.document.write(`<div class="signatures">
            <div class="signature-box"><p class="signature-line"></p><strong>${entrega}</strong><br>${recibeCargo || 'Responsable de Área'}</div>
            <div class="signature-box"><p class="signature-line"></p><strong>${recibe}</strong><br>Firma de Conformidad</div>
        </div>`);
        printWindow.document.write('</body></html>');
        
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }
    function generateAreaClosureReport(options = {}) {
        const { areaId, responsible, location, areaFullName, entrega, recibe, recibeCargo } = options;
        const areaItems = state.inventory.filter(item => item.areaOriginal === areaId);
        const usersInArea = state.resguardantes.filter(user => user.area === areaId).map(user => user.name);
        const additionalItemsInArea = state.additionalItems.filter(item => usersInArea.includes(item.usuario));
        const personalItemsInArea = additionalItemsInArea.filter(i => i.personal === 'Si').length;
        const labelsToPrintInArea = areaItems.filter(i => i['IMPRIMIR ETIQUETA'] === 'SI').length;
        
        const statsByUser = areaItems.reduce((acc, item) => {
            const user = item['NOMBRE DE USUARIO'];
            if (user) acc[user] = (acc[user] || 0) + 1;
            return acc;
        }, {});

        let userStatsHtml = '';
        const userEntries = Object.entries(statsByUser);
        if (userEntries.length > 0) {
            const userMap = new Map(state.resguardantes.map(user => [user.name, user]));
            userStatsHtml += '<h2>Estadísticas Detalladas por Usuario</h2><div class="stats-section"><ul>';
            userEntries.sort((a,b) => b[1] - a[1]).forEach(([user, count]) => {
                const userData = userMap.get(user);
                const userDetails = userData ? ` (Área: ${userData.area}, Ubicación: ${userData.locationWithId})` : '';
                userStatsHtml += `<li><strong>${user}</strong>${userDetails}: ${count} bien(es) asignado(s)</li>`;
            });
            userStatsHtml += '</ul></div>';
        }

        const itemsARegularizar = additionalItemsInArea.filter(item => item.personal === 'Si' && item.tieneFormatoEntrada === false);
        let regularizarHtml = '';
        if(itemsARegularizar.length > 0) {
            regularizarHtml = '<h2>Acciones de Seguimiento</h2><div class="stats-section"><ul>';
            itemsARegularizar.forEach(item => {
                regularizarHtml += `<li>Recuerda a <strong>${item.usuario}</strong> que debe regularizar la entrada de: <em>${item.descripcion}</em>.</li>`;
            });
            regularizarHtml += '</ul></div>';
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Acta de Cierre de Inventario</title>');
        printWindow.document.write(`<style>
            body { font-family: sans-serif; margin: 1.5em; font-size: 0.9em; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5em; border-bottom: 2px solid #ccc; padding-bottom: 1em; }
            .header-logo { max-height: 50px; max-width: 150px; }
            .header-titles { text-align: center; flex-grow: 1; }
            .header-titles p { margin: 0; font-size: 0.9em; color: #555; }
            .header-titles h1 { margin: 0; font-size: 1.3em; font-weight: bold; }
            .header-titles h2 { margin: 0; font-size: 0.9em; font-weight: normal; color: #333; }
            .header-date { font-size: 0.9em; text-align: right; }
            h2 { border-bottom: 1px solid #eee; padding-bottom: 0.25em; margin-top: 1.5em; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5em 1.5em; margin-top: 1.2em; }
            .summary-item { border-left: 3px solid #eee; padding-left: 1em; margin-bottom: 0.5em;}
            .summary-item strong { display: block; font-size: 1.8em; color: #333; }
            .summary-item span { font-size: 0.9em; color: #666; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5em 2em; background-color: #f9f9f9; padding: 1em; border-radius: 5px; margin-top: 1em;}
            .signatures { display: flex; justify-content: space-around; margin-top: 70px; }
            .signature-box { text-align: center; width: 40%; }
            .signature-line { border-bottom: 1px solid #000; margin-bottom: 0.5em; }
            .stats-section ul { list-style-type: square; padding-left: 20px; font-size: 0.9em; }
            .stats-section li { margin-bottom: 0.3em; }
            em { font-style: italic; color: #555; }
        </style></head><body>`);            

        const today = new Date();
        const dateFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const logoSrc = 'logo.png';
        
        printWindow.document.write(`<div class="header">
            <img src="${logoSrc}" alt="Logo" class="header-logo">
            <div class="header-titles">
                <h1>Acta de Cierre de Inventario Físico</h1>
                <h2>${areaFullName}</h2>
            </div>
            <div class="header-date"><b>Fecha:</b> ${dateFormatted}</div>
        </div>`);

        printWindow.document.write(`<div class="info-grid">
            <div><b>Responsable del Área:</b> ${recibeCargo || 'No especificado'}</div>
            <div><b>Cargo:</b> ${recibeCargo || 'No especificado'}</div>
            <div><b>Responsable que Recibe:</b> ${responsible}</div>
            <div><b>Ubicación de Firma:</b> ${location}</div>
        </div>`);
        
        printWindow.document.write(`
            <h2>Resumen Estadístico del Área</h2>
            <div class="summary-grid">
                <div class="summary-item"><strong>${areaItems.length}</strong><span>Bienes del Inventario Original</span></div>
                <div class="summary-item"><strong>${areaItems.length}</strong><span>Bienes Ubicados</span></div>
                <div class="summary-item"><strong>${additionalItemsInArea.length}</strong><span>Bienes Adicionales Encontrados</span></div>
                <div class="summary-item"><strong>${personalItemsInArea}</strong><span>Bienes Adicionales (Personales)</span></div>
                <div class="summary-item"><strong>${labelsToPrintInArea}</strong><span>Bienes por Re-etiquetar</span></div>
                <div class="summary-item"><strong>${usersInArea.length}</strong><span>Usuarios en el Área</span></div>
            </div>
        `);

        printWindow.document.write(userStatsHtml);
        printWindow.document.write(regularizarHtml);

         printWindow.document.write(`
            <div class="signatures">
                <div class="signature-box">
                    <p class="signature-line"></p>
                    <strong>${entrega}</strong><br><span>Entrega (Inventario)</span>
                </div>
                <div class="signature-box">
                    <p class="signature-line"></p>
                    <strong>${recibe}</strong><br><span>Recibe de Conformidad</span>
                </div>
            </div>
        `);

        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }

    function generateTasksReport(options = {}) {
        const itemsWithNotes = Object.keys(state.notes).filter(key => state.notes[key].trim() !== '');
        const itemsWithPendingLabels = state.inventory.filter(item => item['IMPRIMIR ETIQUETA'] === 'SI');
        const additionalItems = state.additionalItems;
        const mismatchedItems = state.inventory.filter(item => item.areaIncorrecta);
        const itemsARegularizar = state.additionalItems.filter(item => item.personal === 'Si' && item.tieneFormatoEntrada === false);


        if (itemsWithNotes.length === 0 && itemsWithPendingLabels.length === 0 && additionalItems.length === 0 && mismatchedItems.length === 0 && itemsARegularizar.length === 0) {
            const noTasksHtml = '<h2>¡Excelente! No hay acciones pendientes.</h2>';
            if (options.returnAsHtml) {
                return `<h2>Plan de Acción Recomendado</h2>${noTasksHtml}`;
            }
             logActivity('Plan de Acción', 'Generado sin acciones pendientes.');
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Plan de Acción Recomendado</title><style>body { font-family: sans-serif; margin: 2em; } h2 { color: #333; }</style></head><body>');
            printWindow.document.write(`<h1>Plan de Acción Recomendado</h1><p>Fecha de Generación: ${new Date().toLocaleString()}</p>`);
            printWindow.document.write(noTasksHtml);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
            return;
        }
        
        logActivity('Plan de Acción', 'Generado con acciones pendientes.');

        let tableRows = '';

        itemsWithPendingLabels.forEach(item => {
            const id = item['CLAVE UNICA'];
            const isChecked = state.actionCheckboxes.labels[id] || false;
            tableRows += `<tr>
                <td><input type="checkbox" class="action-plan-checkbox rounded" data-type="labels" data-id="${id}" ${isChecked ? 'checked' : ''}></td>
                <td><strong>Etiqueta Pendiente</strong></td>
                <td><strong>Clave ${item['CLAVE UNICA']}:</strong> ${(item.DESCRIPCION || '').substring(0, 25)}...</td>
                <td>Asignado a: ${item['NOMBRE DE USUARIO']}</td>
            </tr>`;
        });

        itemsWithNotes.forEach(clave => {
            const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
            const isChecked = state.actionCheckboxes.notes[clave] || false;
            tableRows += `<tr>
                <td><input type="checkbox" class="action-plan-checkbox rounded" data-type="notes" data-id="${clave}" ${isChecked ? 'checked' : ''}></td>
                <td><strong>Nota de Seguimiento</strong></td>
                <td><strong>Clave ${clave}:</strong> ${(item.DESCRIPCION || '').substring(0, 25)}...</td>
                <td><em>"${state.notes[clave]}"</em></td>
            </tr>`;
        });

        additionalItems.forEach(item => {
             if(item.personal === 'No' || item.tieneFormatoEntrada === true) {
                const isChecked = state.actionCheckboxes.additional[item.id] || false;
                tableRows += `<tr>
                    <td><input type="checkbox" class="action-plan-checkbox rounded" data-type="additional" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
                    <td><strong>Bien Adicional</strong></td>
                    <td>${(item.descripcion || '').substring(0, 25)}... (Serie: ${item.serie || 'N/A'})</td>
                    <td>Registrado por: ${item.usuario}. Regularizar y asignar clave de inventario si aplica.</td>
                </tr>`;
            }
        });

        mismatchedItems.forEach(item => {
            const assignedUser = state.resguardantes.find(u => u.name === item['NOMBRE DE USUARIO']);
            const newArea = assignedUser ? assignedUser.area : 'N/A';
            const id = item['CLAVE UNICA'];
            const isChecked = state.actionCheckboxes.mismatched[id] || false;
            tableRows += `<tr>
                <td><input type="checkbox" class="action-plan-checkbox rounded" data-type="mismatched" data-id="${id}" ${isChecked ? 'checked' : ''}></td>
                <td><strong>Bien Fuera de Área</strong></td>
                <td><strong>Clave ${item['CLAVE UNICA']}:</strong> ${(item.DESCRIPCION || '').substring(0, 25)}...</td>
                <td>Área Original: <strong>${item.areaOriginal}</strong>. Ubicación Actual: Área <strong>${newArea}</strong> (Usuario: ${item['NOMBRE DE USUARIO']}).</td>
            </tr>`;
        });
        
        itemsARegularizar.forEach(item => {
            const isChecked = state.actionCheckboxes.personal[item.id] || false;
            tableRows += `<tr>
                <td><input type="checkbox" class="action-plan-checkbox rounded" data-type="personal" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
                <td><strong>Regularización Bien Personal</strong></td>
                <td>${(item.descripcion || '').substring(0, 25)}...</td>
                <td>Recuerda a <strong>${item.usuario}</strong> que debe regularizar la entrada de este bien.</td>
            </tr>`;
        });
        
        const content = `<table>
            <thead>
                <tr>
                    <th>✓</th>
                    <th>Categoría</th>
                    <th>Clave / Descripción</th>
                    <th>Detalle / Acción Recomendada</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>`;

        if (options.returnAsHtml) {
            return `<h2>Plan de Acción Recomendado</h2>${content}`;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Plan de Acción Recomendado</title>');
        printWindow.document.write(`<style>
            body { font-family: sans-serif; margin: 1.5em; } 
            h1 { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 1.5em; font-size: 0.9em; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f2f2f2; border-bottom: 2px solid #999; font-weight: bold; }
            tr { page-break-inside: avoid; }
            em { font-style: italic; color: #555; }
        </style>`);
        printWindow.document.write('</head><body>');
        printWindow.document.write(`<h1>Plan de Acción Recomendado</h1><p>Fecha de Generación: ${new Date().toLocaleString()}</p>`);
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }

    function generateInventoryReport(options = {}) {
        const selectedUser = elements.reports.userFilter.value;
        const selectedArea = elements.reports.areaFilter.value;

        let reportedItems = state.inventory;

        if (selectedUser !== 'all') {
            reportedItems = reportedItems.filter(item => item['NOMBRE DE USUARIO'] === selectedUser);
        }
        if (selectedArea !== 'all') {
            reportedItems = reportedItems.filter(item => item.areaOriginal === selectedArea);
        }

        renderReportTable(reportedItems, 'Reporte de Inventario', { isMismatched: false, isNotesReport: false, headers: ['Clave Única', 'Descripción', 'Marca', 'Modelo', 'Serie', 'Usuario', 'Ubicado', 'Área Original'] });
        showToast(`Reporte generado con ${reportedItems.length} bienes.`);
    }

    function exportInventoryToXLSX() {
        const selectedArea = elements.reports.areaFilter.value;
        let inventoryToExport = state.inventory;
        let additionalToExport = state.additionalItems;
        let fileName = "inventario_completo.xlsx";
        let logMessage = "Exportando inventario completo.";

        if (selectedArea !== 'all') {
            inventoryToExport = state.inventory.filter(item => item.areaOriginal === selectedArea);
            
            const usersInArea = state.resguardantes
                .filter(user => user.area === selectedArea)
                .map(user => user.name);
            additionalToExport = state.additionalItems.filter(item => usersInArea.includes(item.usuario));
            
            fileName = `inventario_area_${selectedArea}.xlsx`;
            logMessage = `Exportando inventario y adicionales para el área ${selectedArea}.`;
        }

        if (inventoryToExport.length === 0 && additionalToExport.length === 0) {
            return showToast('No hay datos para exportar con los filtros actuales.', 'warning');
        }

        showToast('Generando archivo XLSX...');
        logActivity('Exportación XLSX', logMessage);

        try {
            const workbook = XLSX.utils.book_new();

            const inventoryData = inventoryToExport.map(item => ({
                'Clave Unica': String(item['CLAVE UNICA']).startsWith('0.') ? item['CLAVE UNICA'].substring(1) : item['CLAVE UNICA'],
                'Descripcion': item['DESCRIPCION'],
                'Marca': item['MARCA'],
                'Modelo': item['MODELO'],
                'Serie': item['SERIE'],
                'Area Original': item.areaOriginal,
                'Usuario Asignado': item['NOMBRE DE USUARIO'],
                'Ubicado': item['UBICADO'],
                'Requiere Etiqueta': item['IMPRIMIR ETIQUETA'],
                'Tiene Foto': state.photos[item['CLAVE UNICA']] ? 'Si' : 'No',
                'Nota': state.notes[item['CLAVE UNICA']] || ''
            }));

            const inventoryWorksheet = XLSX.utils.json_to_sheet(inventoryData);
            inventoryWorksheet['!cols'] = [
                { wch: 15 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
                { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 50 }
            ];
            XLSX.utils.book_append_sheet(workbook, inventoryWorksheet, "Inventario Principal");

            if (additionalToExport.length > 0) {
                const additionalData = additionalToExport.map(item => ({
                    'Descripcion': item.descripcion,
                    'Clave Original': item.clave || 'N/A',
                    'Marca': item.marca || 'N/A',
                    'Modelo': item.modelo || 'N/A',
                    'Serie': item.serie || 'N/A',
                    'Area Procedencia': item.area || 'N/A',
                    'Usuario Asignado': item.usuario,
                    'Es Personal': item.personal,
                    'Clave Asignada (Regularizado)': item.claveAsignada || 'N/A'
                }));
                const additionalWorksheet = XLSX.utils.json_to_sheet(additionalData);
                additionalWorksheet['!cols'] = [
                    { wch: 50 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
                    { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 25 }
                ];
                XLSX.utils.book_append_sheet(workbook, additionalWorksheet, "Bienes Adicionales");
            }

            XLSX.writeFile(workbook, fileName);
            showToast('Archivo XLSX generado con éxito.', 'success');
        } catch (error) {
            console.error("Error generating XLSX file:", error);
            showToast('Hubo un error al generar el archivo XLSX.', 'error');
        }
    }

    
    function generateSessionSummary(options = {}) {
        const { author, areaResponsible, location } = options;
        const userMap = new Map(state.resguardantes.map(user => [user.name, user]));
        
        logActivity('Resumen de Sesión', 'Generado resumen de sesión.');

        const involvedAreas = [...new Set(state.inventory.map(i => i.areaOriginal))];
        const totalAdditional = state.additionalItems.length;
        const personalAdditional = state.additionalItems.filter(i => i.personal === 'Si').length;
        const labelsToPrint = state.inventory.filter(i => i['IMPRIMIR ETIQUETA'] === 'SI').length;
        const itemsLocated = state.inventory.filter(i => i.UBICADO === 'SI').length;
        const itemsPending = state.inventory.length - itemsLocated;

        let duration = 'No disponible';
        if (state.sessionStartTime) {
            const diff = new Date() - new Date(state.sessionStartTime);
            let totalHours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            if (totalHours >= 24) {
                const days = Math.floor(totalHours / 24);
                const hours = totalHours % 24;
                duration = `${days} día(s), ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                duration = `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }

        const itemsARegularizar = state.additionalItems.filter(item => item.personal === 'Si' && item.tieneFormatoEntrada === false);
        let regularizarHtml = '';
        if(itemsARegularizar.length > 0) {
            regularizarHtml = '<h2>Acciones de Seguimiento</h2><div class="stats-section"><ul>';
            itemsARegularizar.forEach(item => {
                regularizarHtml += `<li>Recuerda a <strong>${item.usuario}</strong> que debe regularizar la entrada de: <em>${item.descripcion}</em>.</li>`;
            });
            regularizarHtml += '</ul></div>';
        }

        const printWindow = window.open('', '_blank');
        
        printWindow.document.write('<html><head><title>Resumen de Sesión de Inventario</title>');
        printWindow.document.write(`<style>
            body { font-family: sans-serif; margin: 1.5em; font-size: 0.9em; }
            .header { display: flex; justify-content: space-between; align-items: center; text-align: left; margin-bottom: 1.5em; border-bottom: 2px solid #ccc; padding-bottom: 1em; }
            .header-logo { max-height: 65px; max-width: 170px; }
            .header-titles { text-align: center; flex-grow: 1; }
            .header-titles p { margin: 0; font-size: 1.1em; color: #555; }
            .header-titles h1 { margin: 0; font-size: 1.6em; font-weight: bold; }
            .header-date { font-size: 0.9em; text-align: right; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5em 1.5em; margin-top: 1em; }
            .summary-item { border-left: 3px solid #eee; padding-left: 1em; margin-bottom: 0.5em;}
            .summary-item strong { display: block; font-size: 1.5em; color: #333; }
            .summary-item span { font-size: 0.9em; color: #666; }
            h2 { border-bottom: 1px solid #eee; padding-bottom: 0.25em; margin-top: 1.5em; }
            .signatures { display: flex; justify-content: space-around; margin-top: 70px; }
            .signature-box { text-align: center; width: 40%; }
            .signature-line { border-bottom: 1px solid #000; margin-bottom: 0.5em; }
            .stats-section { font-size: 0.9em; }
            .stats-section ul { list-style-type: square; padding-left: 20px; }
            .stats-section li { margin-bottom: 0.3em; }
            em { font-style: italic; color: #555; }
            .location-box { background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; margin-bottom: 1em; border-left: 5px solid #6366f1; }
        </style>`);
        printWindow.document.write('</head><body>');
        
        const today = new Date();
        const dateFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const logoSrc = 'logo.png';

        printWindow.document.write('<div class="header">');
        printWindow.document.write(`<div><img src="${logoSrc}" alt="Logo" class="header-logo"></div>`);
        printWindow.document.write('<div class="header-titles">');
        printWindow.document.write(`<p>Dirección de Almacén e Inventarios</p>`);
        printWindow.document.write(`<h1>Resumen de Sesión de Inventario</h1>`);
        printWindow.document.write('</div>');
        printWindow.document.write(`<div class="header-date">${dateFormatted}</div>`);
        printWindow.document.write('</div>');
        
        printWindow.document.write(`<div class="location-box"><b>Ubicación Física del Inventario:</b> ${location}</div>`);

        if (involvedAreas.length > 0) {
            printWindow.document.write('<h2>Detalle de Áreas</h2><ul>');
            involvedAreas.forEach(area => {
                const areaName = state.areaNames[area] || `Área ${area}`;
                const totalBienes = state.inventory.filter(i => i.areaOriginal === area).length;
                printWindow.document.write(`<li><strong>${areaName}:</strong> Cuenta con <strong>${totalBienes}</strong> bienes.</li>`);
            });
            printWindow.document.write('</ul>');
        }
        
        const locationCounts = state.resguardantes.reduce((acc, user) => {
            const loc = user.location || 'Sin Ubicación';
            acc[loc] = (acc[loc] || 0) + 1;
            return acc;
        }, {});

        if (Object.keys(locationCounts).length > 0) {
            printWindow.document.write('<h2>Distribución de Ubicaciones Físicas</h2><ul>');
            Object.entries(locationCounts).forEach(([location, count]) => {
                printWindow.document.write(`<li><strong>${location}:</strong> ${count} ${count > 1 ? 'registros' : 'registro'}</li>`);
            });
            printWindow.document.write('</ul>');
        }

        printWindow.document.write(`
            <h2>Estadísticas Generales</h2>
            <div class="summary-grid">
                <div class="summary-item"><strong>${itemsLocated}</strong><span>Bienes Encontrados</span></div>
                <div class="summary-item"><strong>${itemsPending}</strong><span>Bienes Pendientes de Ubicar</span></div>
                <div class="summary-item"><strong>${totalAdditional}</strong><span>Bienes Adicionales Encontrados</span></div>
                <div class="summary-item"><strong>${personalAdditional}</strong><span>Bienes Personales</span></div>
                <div class="summary-item"><strong>${labelsToPrint}</strong><span>Bienes por etiquetar</span></div>
                <div class="summary-item"><strong>${duration}</strong><span>Tiempo de Sesión</span></div>
            </div>
        `);

        const stats = getDetailedStats();
        let statsHtml = '<h2>Estadísticas Detalladas de la Sesión</h2><div class="stats-section">';

        let assignedUsersHtml = `<div style="margin-bottom: 1em;"><p><strong>Bienes Asignados por Usuario</strong></p>`;
        const assignedEntries = Object.entries(stats.assignedByUser);
        if (assignedEntries.length === 0) {
            assignedUsersHtml += `<p style="color: #666;">No hay datos.</p></div>`;
        } else {
            assignedUsersHtml += '<ul>';
            assignedEntries.forEach(([user, items]) => {
                const userData = userMap.get(user);
                const userDetails = userData ? ` (Área: ${userData.area}, Ubicación: ${userData.locationWithId})` : '';
                assignedUsersHtml += `<li><strong>${user}</strong>${userDetails}: ${items.length}</li>`;
            });
            assignedUsersHtml += '</ul></div>';
        }
        statsHtml += assignedUsersHtml;

        const generateHtmlList = (title, data) => {
            let listHtml = `<div style="margin-bottom: 1em;"><p><strong>${title}</strong></p>`;
            const entries = Object.entries(data);
            if (entries.length === 0) {
                listHtml += `<p style="color: #666;">No hay datos.</p></div>`;
                return listHtml;
            }
            listHtml += '<ul>';
            entries.forEach(([key, value]) => {
                listHtml += `<li><strong>${key || 'Sin Asignar'}:</strong> ${value.length}</li>`;
            });
            listHtml += '</ul></div>';
            return listHtml;
        };

        statsHtml += generateHtmlList('Bienes Pendientes por Área:', stats.pendingByArea);
        statsHtml += generateHtmlList('Etiquetas Pendientes por Usuario:', stats.labelsByUser);
        statsHtml += generateHtmlList('Etiquetas Pendientes por Área:', stats.labelsByArea);
        statsHtml += '</div>';

        printWindow.document.write(statsHtml);
        printWindow.document.write(regularizarHtml);

        printWindow.document.write(`
            <div class="signatures">
                <div class="signature-box">
                    <p class="signature-line"></p>
                    <strong>${author}</strong><br><span>Realizó Inventario</span>
                </div>
                <div class="signature-box">
                    <p class="signature-line"></p>
                    <strong>${areaResponsible}</strong><br><span>Responsable del Área</span>
                </div>
            </div>
        `);
        
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }
    
    async function exportSession(isFinal = false) {
        const { overlay, text } = elements.loadingOverlay;
        const type = isFinal ? 'FINALIZADO' : 'backup-editable';
        text.textContent = 'Generando archivo de respaldo...';
        overlay.classList.add('show');
    
        try {
            const zip = new JSZip();
    
            const stateToSave = { ...state };
            if (isFinal) {
                stateToSave.readOnlyMode = true; 
            }
            delete stateToSave.serialNumberCache;
            delete stateToSave.cameraStream;
            zip.file("session.json", JSON.stringify(stateToSave));
    
            text.textContent = 'Empaquetando fotos...';
            const allPhotos = await photoDB.getAllItems();
            if (allPhotos.length > 0) {
                const photoFolder = zip.folder("photos");
                for (const { key, value } of allPhotos) {
                    photoFolder.file(key, value);
                }
            }

            text.textContent = 'Comprimiendo archivo...';
            const content = await zip.generateAsync({ type: "blob" });
    
            const a = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            a.href = URL.createObjectURL(content);
            a.download = `inventario-${type}-${date}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
    
            logActivity('Sesión exportada', `Tipo: ${type}`);
            showToast(`Sesión ${isFinal ? 'finalizada y' : ''} exportada como .zip`);
        } catch (e) {
            console.error('Error al exportar la sesión como .zip:', e);
            showToast('Error al exportar la sesión.', 'error');
        } finally {
            overlay.classList.remove('show');
        }
    }

    function renderLoadedLists() {
        const container = elements.settings.loadedListsContainer;
        const countEl = document.getElementById('loaded-lists-count');
        container.innerHTML = '';

        const loadedLists = [...new Map(state.inventory.map(item => [item.listId, item])).values()];

        countEl.textContent = `Total: ${loadedLists.length}`;

        if (loadedLists.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No hay listados cargados.</p>';
            return;
        }

        loadedLists.forEach(list => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-slate-800';
            
            const isAreaClosed = !!state.closedAreas[list.areaOriginal];
            const reprintButtonHtml = isAreaClosed ? `
                <button data-area-id="${list.areaOriginal}" class="reprint-area-report-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600">Reimprimir Acta</button>
            ` : '';

            item.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold text-sm text-gray-500 dark:text-slate-400">Área: <span class="text-gray-900 dark:text-slate-100">${list.areaOriginal}</span></p>
                    <p class="font-semibold text-sm text-gray-500 dark:text-slate-400">Tipo de Libro: <span class="text-gray-900 dark:text-slate-100">${list.listadoOriginal}</span></p>
                    <p class="font-semibold text-sm text-gray-500 dark:text-slate-400">Archivo: <span class="text-gray-700 dark:text-slate-300 italic">${list.fileName}</span></p>
                </div>
                <div class="flex flex-col space-y-2 items-end">
                    ${reprintButtonHtml}
                    <button data-list-id="${list.listId}" class="delete-list-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600">Eliminar Listado</button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    function renderDirectory() {
        const container = elements.settings.directoryContainer;
        const countEl = elements.settings.directoryCount;
        const areas = Object.keys(state.areaDirectory);

        countEl.textContent = `Total: ${areas.length}`;
        
        if (areas.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No se han cargado áreas con información de responsable.</p>';
            return;
        }
        
        container.innerHTML = areas.sort().map((areaKey, index) => {
            const areaInfo = state.areaDirectory[areaKey];
            return `
                <div class="p-3 rounded-lg bg-white dark:bg-slate-800 text-gray-800 border-l-4 border-indigo-400 shadow-sm">
                    <p class="font-bold text-sm text-gray-900 dark:text-slate-100">
                        ${index + 1}. ${areaInfo.fullName || `ÁREA ${areaKey}`}
                    </p>
                    <p class="text-sm mt-1 text-gray-700 dark:text-slate-300">
                        <strong>Responsable:</strong> ${areaInfo.name || 'No encontrado'}
                    </p>
                     <p class="text-sm text-gray-700 dark:text-slate-300">
                        <strong>Cargo:</strong> ${areaInfo.title || 'No encontrado'}
                    </p>
                </div>
            `;
        }).join('');
    }

    function deleteListAndRefresh(listId) {
        const listToDelete = state.inventory.find(i => i.listId === listId);
        if (!listToDelete) return;

        logActivity('Listado eliminado', `Archivo: ${listToDelete.fileName}, Área: ${listToDelete.areaOriginal}`);
        state.inventory = state.inventory.filter(item => item.listId !== listId);
        showToast(`Listado "${listToDelete.fileName}" eliminado.`);
        updateSerialNumberCache();
        saveState();
        renderDashboard();
        populateAreaSelects();
        populateUserSelects();
        currentPage = 1;
        filterAndRenderInventory();
        renderLoadedLists();
    }

    function showReassignModal(listId, areaOriginal, affectedUsers, affectedAdicionales) {
        const { modal, text, areaSelect, confirmBtn, keepBtn, deleteAllBtn, cancelBtn } = elements.reassignModal;
        
        text.textContent = `El listado del área ${areaOriginal} tiene ${affectedUsers.length} usuario(s) y ${affectedAdicionales.length} bien(es) asociado(s). Elige una acción.`;
        
        areaSelect.innerHTML = state.areas
            .filter(area => area !== areaOriginal)
            .map(area => `<option value="${area}">Área ${area}</option>`)
            .join('');
        
        if (areaSelect.options.length === 0) {
            areaSelect.disabled = true;
            confirmBtn.disabled = true;
            areaSelect.innerHTML = '<option>No hay otras áreas disponibles</option>';
        } else {
            areaSelect.disabled = false;
            confirmBtn.disabled = false;
        }
        
        modal.classList.add('show');
        
        const confirmHandler = () => {
            const newArea = areaSelect.value;
            if (!newArea) return showToast('Por favor, selecciona un área para reasignar.', 'error');
            
            affectedUsers.forEach(user => user.area = newArea);
            logActivity('Usuarios reasignados', `${affectedUsers.length} usuarios del área ${areaOriginal} movidos al área ${newArea}.`);
            showToast(`${affectedUsers.length} usuario(s) reasignado(s) al área ${newArea}.`);
            deleteListAndRefresh(listId);
            closeModal();
        };
        
        const keepHandler = () => {
            if (!state.persistentAreas) state.persistentAreas = [];
            if (!state.persistentAreas.includes(areaOriginal)) {
                state.persistentAreas.push(areaOriginal);
            }
            logActivity('Área mantenida', `El área ${areaOriginal} se mantuvo a pesar de eliminar el listado.`);
            showToast(`Los usuarios y bienes se mantendrán en el área ${areaOriginal}.`);
            deleteListAndRefresh(listId);
            closeModal();
        };
        
        const deleteAllHandler = () => {
            showConfirmationModal(
                '¡ADVERTENCIA!', 
                `Esto eliminará permanentemente ${affectedUsers.length} usuario(s) y ${affectedAdicionales.length} bien(es) asociado(s). Esta acción no se puede deshacer. ¿Continuar?`, 
                () => {
                    const affectedUserIds = affectedUsers.map(u => u.id);
                    const affectedUserNames = affectedUsers.map(u => u.name);
                    state.resguardantes = state.resguardantes.filter(u => !affectedUserIds.includes(u.id));
                    state.additionalItems = state.additionalItems.filter(item => !affectedUserNames.includes(item.usuario));
                    logActivity('Eliminación masiva', `Se eliminaron ${affectedUsers.length} usuarios y ${affectedAdicionales.length} bienes del área ${areaOriginal}.`);
                    showToast(`Se eliminaron usuarios y bienes del área ${areaOriginal}.`, 'warning');
                    deleteListAndRefresh(listId);
                    closeModal();
                }
            );
        };

        const closeModal = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', confirmHandler);
            keepBtn.removeEventListener('click', keepHandler);
            deleteAllBtn.removeEventListener('click', deleteAllHandler);
            cancelBtn.removeEventListener('click', closeModal);
        };

        confirmBtn.addEventListener('click', confirmHandler, { once: true });
        keepBtn.addEventListener('click', keepHandler, { once: true });
        deleteAllBtn.addEventListener('click', deleteAllHandler, { once: true });
        cancelBtn.addEventListener('click', closeModal, { once: true });
    }

    function showMainApp() {
        elements.loginPage.classList.add('hidden');
        elements.mainApp.classList.remove('hidden');
        elements.currentUserDisplay.textContent = state.currentUser.name;
        elements.settings.summaryAuthor.value = state.currentUser.name;

        updateTheme(state.theme);
        renderDashboard();
        populateAreaSelects();
        populateUserSelects();
        populateBookTypeFilter();
        currentPage = 1;
        filterAndRenderInventory();
        startAutosave();
        renderLoadedLists();
        renderDirectory();
        checkReadOnlyMode();
        changeTab('users');
    }

    function handleEmployeeLogin() {
        const employeeNumber = elements.employeeNumberInput.value;
        const employeeName = verifiers[employeeNumber];
        
        if (employeeName) {
            const newCurrentUser = { number: employeeNumber, name: employeeName };

            if (state.loggedIn && state.currentUser.number !== newCurrentUser.number) {
                 showConfirmationModal(
                    'Cambio de Usuario',
                    `Actualmente hay un inventario en progreso. ¿Deseas continuar con el inventario actual como ${employeeName} o iniciar uno nuevo?`,
                    () => {
                        logActivity('Cambio de usuario', `Sesión continuada por ${employeeName}.`);
                        state.currentUser = newCurrentUser;
                        showToast(`Bienvenido de nuevo, ${employeeName}. Continuando con la sesión actual.`);
                        saveState();
                        showMainApp();
                    },
                    { 
                        confirmText: 'Continuar', 
                        cancelText: 'Iniciar Nuevo',
                        onCancel: () => {
                             state.currentUser = newCurrentUser;
                             resetInventoryState();
                        }
                    }
                );
            } else {
                state.loggedIn = true;
                state.currentUser = newCurrentUser;
                if (!state.sessionStartTime) {
                    state.sessionStartTime = new Date().toISOString();
                    logActivity('Inicio de sesión', `Usuario ${employeeName} ha iniciado sesión.`);
                } else {
                    logActivity('Reanudación de sesión', `Usuario ${employeeName} ha reanudado la sesión.`);
                }
                showToast(`Bienvenido, ${employeeName}`);
                saveState();
                showMainApp();
            }

        } else {
            showToast('Este sistema solo puede ser utilizado por personal de Almacén e inventarios.', 'error');
        }
        elements.employeeNumberInput.value = '';
    }
    
    async function startCamera() {
        if (state.readOnlyMode) return;
        const { cameraStream, uploadContainer, cameraViewContainer } = elements.photo;
        
        stopCamera(); // Detener stream anterior si existe

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            let constraints = { video: { facingMode: { exact: "environment" } } };
            try {
                state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e) {
                console.warn("Could not get exact environment camera, trying default environment camera.", e);
                constraints = { video: { facingMode: "environment" } };
                try {
                    state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (e2) {
                    console.warn("Could not get environment camera, trying any camera.", e2);
                    constraints = { video: true };
                    try {
                        state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                    } catch (e3) {
                         showToast('No se pudo acceder a ninguna cámara.', 'error');
                         console.error("Error al acceder a la cámara: ", e3);
                         return;
                    }
                }
            }
            cameraStream.srcObject = state.cameraStream;
            uploadContainer.classList.add('hidden');
            cameraViewContainer.classList.remove('hidden');
        } else {
            showToast('Tu navegador no soporta el acceso a la cámara.', 'error');
        }
    }
    
    function stopCamera() {
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(track => track.stop());
            state.cameraStream = null;
        }
    }
    
    function generateInstitutionalAdicionalesReport(options = {}) {
        const institutionalItems = state.additionalItems.filter(item => item.personal === 'No');
        
        const reportOptions = {
            isInstitutionalReport: true, 
            headers: ['✓', 'Descripción', 'Clave Original', 'Área Procedencia', 'Marca', 'Serie', 'Usuario', 'Clave Asignada', 'Acción']
        };
        
        renderReportTable(institutionalItems, 'Regularización de Bienes Adicionales Institucionales', reportOptions);
        showToast(`Reporte generado con ${institutionalItems.length} bienes institucionales.`);
        logActivity('Reporte Adicionales (Institucionales)', `Generado con ${institutionalItems.length} bienes.`);
    }

    function initialize() {
        photoDB.init().catch(err => console.error('No se pudo iniciar la base de datos de fotos:', err));

        elements.employeeLoginBtn.addEventListener('click', handleEmployeeLogin);
        elements.employeeNumberInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleEmployeeLogin();
            }
        });
        
        elements.dashboard.toggleBtn.addEventListener('click', () => {
            elements.dashboard.headerAndDashboard.classList.toggle('hidden');
        });
        
        elements.logo.title.addEventListener('click', () => {
            logoClickCount++;
            if (logoClickCount >= 5) {
                const logText = state.activityLog.join('\n');
                const blob = new Blob([logText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `log_inventario_${new Date().toISOString().slice(0,10)}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('Registro de actividad descargado.');
                logActivity('Log descargado', 'El usuario ha descargado el registro de actividad.');
                logoClickCount = 0;
            }
        });


        elements.clearSessionLink.addEventListener('click', (e) => {
            e.preventDefault();
            showConfirmationModal('Limpiar Sesión Completa', 'Esto borrará TODO el progreso, incluyendo usuarios e inventario guardado en este navegador. ¿Estás seguro?', () => {
                localStorage.removeItem('inventarioProState');
                deleteDB('InventarioProPhotosDB').finally(() => {
                   window.location.reload();
                });
            });
        });
        elements.logoutBtn.addEventListener('click', () => {
             logActivity('Cierre de sesión', `Usuario ${state.currentUser.name} ha salido.`);
             saveState();
             elements.mainApp.classList.add('hidden');
             elements.loginPage.classList.remove('hidden');
        });

        elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => {
            [...e.target.files].forEach(file => processFile(file));
            e.target.value = '';
        });
        elements.tabsContainer.addEventListener('click', e => {
            const tabBtn = e.target.closest('.tab-btn');
            if(tabBtn && tabBtn.dataset.tab) changeTab(tabBtn.dataset.tab);
        });
        
        const debouncedSearch = debounce(() => {
            currentPage = 1;
            filterAndRenderInventory();
        }, 300);
        elements.inventory.searchInput.addEventListener('input', debouncedSearch);

        elements.inventory.tableBody.addEventListener('click', (e) => {
            const target = e.target;
            const row = target.closest('tr');
            const clave = row?.dataset.clave;
            if (!clave) return;

            if (target.closest('.note-icon, .camera-icon, .view-qr-btn, .view-details-btn')) {
                if (target.closest('.note-icon')) showNotesModal(clave);
                else if (target.closest('.camera-icon')) showPhotoModal('inventory', clave);
                else if (target.closest('.view-qr-btn')) showQrModal(clave);
                else if (target.closest('.view-details-btn')) showItemDetailsModal(clave);
            } 
            else {
                showItemDetailView(clave);
            }
        });

        elements.detailView.closeBtn.addEventListener('click', () => {
            elements.detailView.modal.classList.remove('show');
        });

        elements.inventory.statusFilter.addEventListener('change', () => { currentPage = 1; filterAndRenderInventory(); });
        elements.inventory.areaFilter.addEventListener('change', () => { currentPage = 1; filterAndRenderInventory(); });
        elements.inventory.bookTypeFilter.addEventListener('change', () => { currentPage = 1; filterAndRenderInventory(); });
        elements.inventory.selectAllCheckbox.addEventListener('change', e =>
            document.querySelectorAll('.inventory-item-checkbox').forEach(cb => cb.checked = e.target.checked));
        elements.inventory.ubicadoBtn.addEventListener('click', () => handleInventoryActions('ubicar'));
        elements.inventory.reEtiquetarBtn.addEventListener('click', () => handleInventoryActions('re-etiquetar'));
        elements.inventory.addNoteBtn.addEventListener('click', () => showNotesModal());
        elements.inventory.qrScanBtn.addEventListener('click', startQrScanner);
        elements.inventory.clearSearchBtn.addEventListener('click', () => {
            elements.inventory.searchInput.value = '';
            elements.inventory.statusFilter.value = 'all';
            elements.inventory.areaFilter.value = 'all';
            elements.inventory.bookTypeFilter.value = 'all';
            currentPage = 1;
            filterAndRenderInventory();
            elements.inventory.searchInput.focus();
        });
        elements.inventory.prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderInventoryTable(); }});
        elements.inventory.nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
            if (currentPage < totalPages) { currentPage++; renderInventoryTable(); }
        });

        elements.userForm.createBtn.addEventListener('click', () => {
            if (state.readOnlyMode) return;
            const name = elements.userForm.name.value.trim();
            const area = elements.userForm.areaSelect.value;
            const locationType = elements.userForm.locationSelect.value;
            const locationManual = elements.userForm.locationManual.value.trim();
            
            if (!name || !area || (locationType === 'OTRA' && !locationManual)) {
                return showToast('Todos los campos son obligatorios', 'error');
            }

            const createUserAction = () => {
                const locationBase = locationType === 'OTRA' ? locationManual : locationType;
                state.locations[locationBase] = (state.locations[locationBase] || 0) + 1;
                const locationId = String(state.locations[locationBase]).padStart(2, '0');
                const locationWithId = `${locationBase} ${locationId}`;

                const newUser = { name, area, location: locationBase, locationWithId, id: generateUUID() };
                state.resguardantes.push(newUser);
                state.activeResguardante = newUser;
                
                logActivity('Usuario creado', `Nombre: ${name}, Área: ${area}, Ubicación: ${locationWithId}`);

                renderUserList();
                populateAreaSelects();
                populateUserSelects();
                saveState();
                showToast(`Usuario ${name} creado y activado.`);
                elements.userForm.name.value = '';
                elements.userForm.locationManual.value = '';
                elements.userForm.locationSelect.value = 'OFICINA';
                elements.userForm.locationManual.classList.add('hidden');
            };

            const existingUser = state.resguardantes.find(u => u.name.trim().toLowerCase() === name.toLowerCase());
            if (existingUser) {
                showConfirmationModal('Usuario Existente', `El usuario "${name}" ya existe. ¿Confirmas que deseas registrarlo en esta nueva ubicación?`, createUserAction);
            } else {
                createUserAction();
            }
        });
        elements.userForm.locationSelect.addEventListener('change', e => elements.userForm.locationManual.classList.toggle('hidden', e.target.value !== 'OTRA'));
        
        elements.userForm.list.addEventListener('click', e => {
            const button = e.target.closest('button');
            const icon = e.target.closest('i.location-photo-btn');

            if(icon) {
                const locationId = icon.dataset.locationId;
                if (locationId) showPhotoModal('location', locationId);
                return;
            }

            if (!button || state.readOnlyMode) return;
            const index = parseInt(button.dataset.index, 10);
            
            if (button.classList.contains('activate-user-btn')) {
                const user = state.resguardantes[index];
                state.activeResguardante = user;
                logActivity('Usuario activado', `Usuario: ${user.name}`);
                showToast(`Usuario ${user.name} activado.`);
                renderUserList();
            } else if (button.classList.contains('edit-user-btn')) {
                showEditUserModal(index);
            } else if (button.classList.contains('delete-user-btn')) {
                const user = state.resguardantes[index];
                const assignedItemsCount = state.inventory.filter(item => item['NOMBRE DE USUARIO'] === user.name).length;
                
                let title = '¿Eliminar Usuario?';
                let text = `¿Estás seguro de que quieres eliminar a ${user.name}?`;

                if (assignedItemsCount > 0) {
                    title = '¡Advertencia! Usuario con Bienes Asignados';
                    text = `El usuario ${user.name} tiene ${assignedItemsCount} bien(es) bajo su resguardo. Si lo eliminas, estos bienes quedarán sin un responsable válido. ¿Estás seguro de que quieres continuar?`;
                }

                showConfirmationModal(title, text, () => {
                    const recentlyDeleted = { item: user, originalIndex: index };
                    state.resguardantes.splice(index, 1);
                    if (state.activeResguardante?.id === user.id) state.activeResguardante = null;

                    recalculateLocationCounts();
                    renderUserList();
                    populateUserSelects();
                    logActivity('Usuario eliminado', `Nombre: ${user.name} (tenía ${assignedItemsCount} bienes)`);
                    
                    showUndoToast('Usuario eliminado.', () => {
                        state.resguardantes.splice(recentlyDeleted.originalIndex, 0, recentlyDeleted.item);
                        recalculateLocationCounts();
                        renderUserList(); 
                        saveState(); 
                        showToast('Acción deshecha.');
                        logActivity('Acción deshecha', `Restaurado usuario eliminado: ${user.name}`);
                    });

                    saveState();
                });
            }
        });
        
        elements.adicionales.form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const form = e.target.form;
                const focusable = Array.from(form.querySelectorAll('input, select, button, textarea'));
                const index = focusable.indexOf(e.target);
                const nextElement = focusable[index + 1];
                if (nextElement) {
                    nextElement.focus();
                } else {
                     elements.adicionales.addBtn.click();
                }
            }
        });

        elements.adicionales.addBtn.addEventListener('click', () => {
            if (state.readOnlyMode) return;
            if (!state.activeResguardante) return showToast('Debe activar un usuario resguardante para registrar bienes.', 'error');
            
            const formData = new FormData(elements.adicionales.form);
            const newItem = Object.fromEntries(formData.entries());
            if (!newItem.descripcion) return showToast('La descripción es obligatoria.', 'error');
            
            const newSerie = newItem.serie.trim();
            if (newSerie && state.serialNumberCache.has(newSerie.toLowerCase())) {
                return showToast('Advertencia: La serie de este bien ya existe en el inventario.', 'warning');
            }

            newItem.usuario = state.activeResguardante.name;
            newItem.id = generateUUID();
            newItem.fechaRegistro = new Date().toISOString();

            const finalizeItemAddition = (item) => {
                state.additionalItems.push(item);
                logActivity('Bien adicional registrado', `Descripción: ${item.descripcion}, Usuario: ${item.usuario}`);
                showToast('Bien adicional registrado.');
                elements.adicionales.form.reset();
                document.getElementById('ad-clave').value = '';
                document.querySelector('#adicional-form input[name="personal"][value="No"]').checked = true;
                renderAdicionalesList(); saveState(); renderDashboard(); updateSerialNumberCache();
                document.getElementById('ad-clave').focus();
            };

            if (newItem.personal === 'Si') {
                const { modal, siBtn, noBtn } = elements.formatoEntradaModal;
                modal.classList.add('show');
                const siHandler = () => { newItem.tieneFormatoEntrada = true; finalizeItemAddition(newItem); closeModal(); };
                const noHandler = () => { newItem.tieneFormatoEntrada = false; finalizeItemAddition(newItem); closeModal(); };
                const closeModal = () => { modal.classList.remove('show'); siBtn.removeEventListener('click', siHandler, { once: true }); noBtn.removeEventListener('click', noHandler, { once: true }); };
                siBtn.addEventListener('click', siHandler, { once: true });
                noBtn.addEventListener('click', noHandler, { once: true });
            } else {
                finalizeItemAddition(newItem);
            }
        });

        elements.adicionales.areaFilter.addEventListener('change', () => {
            populateAdicionalesFilters();
            renderAdicionalesList();
        });
        elements.adicionales.userFilter.addEventListener('change', renderAdicionalesList);
        
        elements.adicionales.list.addEventListener('click', e => {
            if (state.readOnlyMode) return;

            const editBtn = e.target.closest('.edit-adicional-btn');
            const deleteBtn = e.target.closest('.delete-adicional-btn');
            const photoBtn = e.target.closest('.adicional-photo-btn');
            
            const id = editBtn?.dataset.id || deleteBtn?.dataset.id || photoBtn?.dataset.id;
            
            if (!id) return;
            
            const item = state.additionalItems.find(i => i.id === id);
            if (!item) return;

            if (editBtn) {
                showEditAdicionalModal(id);
            }
            
            if (deleteBtn) {
                showConfirmationModal('Eliminar Bien Adicional', `¿Seguro que quieres eliminar "${item.descripcion}"?`, () => {
                    state.additionalItems = state.additionalItems.filter(i => i.id !== id);
                    photoDB.deleteItem(`additional-${id}`);
                    delete state.additionalPhotos[id];
                    renderAdicionalesList(); 
                    renderDashboard(); 
                    saveState(); 
                    updateSerialNumberCache();
                    logActivity('Bien adicional eliminado', `Descripción: ${item.descripcion}`);
                    showToast('Bien adicional eliminado.');
                });
            }
            
            if (photoBtn) {
                showPhotoModal('additional', id);
            }
        });


        elements.reports.exportXlsxBtn.addEventListener('click', exportInventoryToXLSX);
        elements.reports.exportLabelsXlsxBtn.addEventListener('click', exportLabelsToXLSX);
        
        elements.reports.reportButtons.forEach(button => {
            button.addEventListener('click', () => {
                const reportType = button.dataset.reportType;
                if (!reportType) return;
                showPreprintModal(reportType);
            });
        });

        
        elements.reports.tableBody.addEventListener('click', (e) => {
            if(state.readOnlyMode) return;
            const saveBtn = e.target.closest('.save-new-clave-btn');
            if (saveBtn) {
                const itemId = saveBtn.dataset.id;
                const row = saveBtn.closest('tr');
                const input = row.querySelector('.new-clave-input');
                const newClave = input.value.trim();

                if (newClave && state.serialNumberCache.has(newClave.toLowerCase())) {
                    const item = state.additionalItems.find(i => i.id === itemId);
                    if (!item || item.claveAsignada !== newClave) {
                        return showToast('Error: Esa clave o número de serie ya existe en el inventario.', 'error');
                    }
                }

                const itemIndex = state.additionalItems.findIndex(i => i.id === itemId);
                if (itemIndex !== -1) {
                    state.additionalItems[itemIndex].claveAsignada = newClave;
                    updateSerialNumberCache();
                    saveState();
                    logActivity('Clave Asignada a Bien Adicional actualizada', `ID: ${itemId}, Nueva Clave: ${newClave || 'NINGUNA'}`);
                    showToast('Clave actualizada con éxito.', 'success');
                }
            }
        });

        elements.reports.tableBody.addEventListener('change', (e) => {
            const checkbox = e.target;
            if (checkbox.classList.contains('report-item-checkbox')) {
                const clave = checkbox.dataset.clave;
                const reportType = checkbox.dataset.reportType;
                if (clave && reportType && state.reportCheckboxes[reportType]) {
                    state.reportCheckboxes[reportType][clave] = checkbox.checked;
                    saveState();
                }
            }
            else if (checkbox.classList.contains('institutional-report-checkbox')) {
                const itemId = checkbox.dataset.id;
                if (itemId) {
                    state.institutionalReportCheckboxes[itemId] = checkbox.checked;
                    saveState();
                }
            }
            else if (checkbox.classList.contains('action-plan-checkbox')) {
                const type = checkbox.dataset.type;
                const id = checkbox.dataset.id;
                if (type && id && state.actionCheckboxes[type]) {
                    state.actionCheckboxes[type][id] = checkbox.checked;
                    saveState();
                }
            }
        });


        elements.areaClosure.cancelBtn.addEventListener('click', () => elements.areaClosure.modal.classList.remove('show'));
        elements.noteSaveBtn.addEventListener('click', e => {
            if (state.readOnlyMode) return;
            const claves = JSON.parse(e.target.dataset.claves);
            const noteText = elements.noteTextarea.value.trim();
            claves.forEach(clave => state.notes[clave] = noteText);
            logActivity('Nota guardada', `Nota para clave(s): ${claves.join(', ')}`);
            showToast('Nota(s) guardada(s).');
            elements.notesModal.classList.remove('show');
            filterAndRenderInventory(); saveState();
        });
        elements.editAdicionalModal.saveBtn.addEventListener('click', () => {
            const id = elements.editAdicionalModal.saveBtn.dataset.id;
            const itemIndex = state.additionalItems.findIndex(i => i.id === id);
            if (itemIndex === -1) return;
            const formData = new FormData(elements.editAdicionalModal.form);
            const updatedData = Object.fromEntries(formData.entries());
            state.additionalItems[itemIndex] = { ...state.additionalItems[itemIndex], ...updatedData };
            elements.editAdicionalModal.modal.classList.remove('show');
            renderAdicionalesList(); updateSerialNumberCache(); saveState();
            logActivity('Bien adicional editado', `ID: ${id}`);
            showToast('Bien adicional actualizado.');
        });
        
        elements.photo.useCameraBtn.addEventListener('click', startCamera);

        elements.photo.switchToUploadBtn.addEventListener('click', () => {
            stopCamera();
            elements.photo.cameraViewContainer.classList.add('hidden');
            elements.photo.uploadContainer.classList.remove('hidden');
        });
        elements.photo.captureBtn.addEventListener('click', () => {
            const { cameraStream, photoCanvas, input } = elements.photo;
            const context = photoCanvas.getContext('2d');
            photoCanvas.width = cameraStream.videoWidth;
            photoCanvas.height = cameraStream.videoHeight;
            context.drawImage(cameraStream, 0, 0, photoCanvas.width, photoCanvas.height);
            
            photoCanvas.toBlob(blob => {
                if (blob) {
                    const type = input.dataset.type;
                    const id = input.dataset.id;
                    if (blob.size > 2 * 1024 * 1024) return showToast('La imagen es demasiado grande (máx 2MB).', 'error');

                    photoDB.setItem(`${type}-${id}`, blob).then(() => {
                        if (type === 'inventory') { state.photos[id] = true; filterAndRenderInventory(); updateDetailViewPhoto(id); } 
                        else if (type === 'additional') { state.additionalPhotos[id] = true; renderAdicionalesList(); }
                        else if (type === 'location') { state.locationPhotos[id] = true; renderUserList(); }
                        logActivity('Foto capturada', `Tipo: ${type}, ID: ${id}`);
                        showToast(`Foto adjuntada.`);
                        elements.photo.modal.classList.remove('show');
                        stopCamera(); saveState();
                    }).catch(err => showToast('Error al guardar la foto.', 'error'));
                }
            }, 'image/jpeg', 0.9);
        });

        elements.photo.input.addEventListener('change', e => {
            const file = e.target.files[0];
            const type = e.target.dataset.type;
            const id = e.target.dataset.id;
            if (file && type && id) {
                if (file.size > 2 * 1024 * 1024) return showToast('La imagen es demasiado grande (máx 2MB).', 'error');
                photoDB.setItem(`${type}-${id}`, file).then(() => {
                    if (type === 'inventory') { state.photos[id] = true; filterAndRenderInventory(); updateDetailViewPhoto(id); } 
                    else if (type === 'additional') { state.additionalPhotos[id] = true; renderAdicionalesList(); }
                    else if (type === 'location') { state.locationPhotos[id] = true; renderUserList(); }
                    logActivity('Foto subida', `Tipo: ${type}, ID: ${id}`);
                    showToast(`Foto adjuntada.`);
                    stopCamera();
                    elements.photo.modal.classList.remove('show'); saveState();
                }).catch(err => showToast('Error al guardar la foto.', 'error'));
            }
        });
        elements.photo.deleteBtn.addEventListener('click', e => {
            const type = e.target.dataset.type;
            const id = e.target.dataset.id;
            showConfirmationModal('Eliminar Foto', `¿Seguro que quieres eliminar la foto?`, () => {
                photoDB.deleteItem(`${type}-${id}`).then(() => {
                    if (type === 'inventory') { delete state.photos[id]; filterAndRenderInventory(); updateDetailViewPhoto(id); } 
                    else if (type === 'additional') { delete state.additionalPhotos[id]; renderAdicionalesList(); }
                    else if (type === 'location') { delete state.locationPhotos[id]; renderUserList(); }
                    logActivity('Foto eliminada', `Tipo: ${type}, ID: ${id}`);
                    showToast(`Foto eliminada.`);
                    stopCamera();
                    elements.photo.modal.classList.remove('show'); saveState();
                }).catch(err => showToast('Error al eliminar la foto.', 'error'));
            });
        });

        elements.editUserSaveBtn.addEventListener('click', e => {
            const index = e.target.dataset.userIndex;
            const oldName = state.resguardantes[index].name;
            const newName = document.getElementById('edit-user-name').value;
            state.resguardantes[index].name = newName;
            state.resguardantes[index].locationWithId = document.getElementById('edit-user-location').value;
            const locationBase = document.getElementById('edit-user-location').value.replace(/\s\d+$/, '');
            state.resguardantes[index].location = locationBase;

            state.resguardantes[index].area = elements.editUserAreaSelect.value;
            if (oldName !== newName) {
                state.inventory.forEach(i => { if(i['NOMBRE DE USUARIO'] === oldName) i['NOMBRE DE USUARIO'] = newName; });
                state.additionalItems.forEach(i => { if(i.usuario === oldName) i.usuario = newName; });
            }

            if (state.activeResguardante && state.activeResguardante.id === state.resguardantes[index].id) {
                state.activeResguardante = state.resguardantes[index];
            }
            
            recalculateLocationCounts();

            elements.editUserModal.classList.remove('show');
            renderUserList(); 
            populateUserSelects();
            saveState(); 
            logActivity('Usuario editado', `Nombre anterior: ${oldName}, Nombre nuevo: ${newName}`);
            showToast('Usuario actualizado.');
        });

        [elements.noteCancelBtn, elements.photo.closeBtn, elements.editUserCancelBtn, elements.editAdicionalModal.cancelBtn, elements.qrDisplayModal.closeBtn, elements.itemDetailsModal.closeBtn, elements.preprintModal.cancelBtn].forEach(btn =>
            btn.addEventListener('click', () => {
                stopCamera();
                btn.closest('.modal-overlay').classList.remove('show');
            })
        );
        elements.qrScannerCloseBtn.addEventListener('click', stopQrScanner);

        elements.settings.themes.forEach(btn => btn.addEventListener('click', () => updateTheme(btn.dataset.theme)));
        
        elements.settings.exportSessionBtn.addEventListener('click', () => exportSession(false));
        elements.settings.finalizeInventoryBtn.addEventListener('click', () => {
            showConfirmationModal('Finalizar Inventario', 'Esto creará un archivo de respaldo final de solo lectura. No podrás realizar más cambios en este inventario. ¿Estás seguro?', () => {
                exportSession(true);
            });
        });
        
        elements.settings.importSessionBtn.addEventListener('click', () => elements.settings.importFileInput.click());
        
        elements.settings.importFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file || !file.name.endsWith('.zip')) {
                return showToast('Por favor, selecciona un archivo de sesión .zip válido.', 'error');
            }
            
            logActivity('Importación de sesión', `Archivo: ${file.name}`);
            const { overlay, text } = elements.loadingOverlay;
            text.textContent = 'Abriendo archivo de sesión...';
            overlay.classList.add('show');

            try {
                const jszip = new JSZip();
                const zip = await jszip.loadAsync(file);
                
                const sessionFile = zip.file('session.json');
                if (!sessionFile) throw new Error('El archivo .zip no contiene un session.json válido.');

                const sessionData = await sessionFile.async('string');
                const importedState = JSON.parse(sessionData);
                
                const photoFolder = zip.folder("photos");
                if (photoFolder) {
                    overlay.classList.remove('show');
                    elements.importProgress.modal.classList.add('show');
                    
                    const photoFiles = [];
                    photoFolder.forEach((relativePath, file) => {
                        if (!file.dir) {
                            photoFiles.push(file);
                        }
                    });
                    
                    const totalPhotos = photoFiles.length;
                    let processedPhotos = 0;
                    
                    for (const file of photoFiles) {
                        const key = file.name.split('/').pop();
                        const blob = await file.async("blob");
                        await photoDB.setItem(key, blob);
                        processedPhotos++;
                        
                        const percent = Math.round((processedPhotos / totalPhotos) * 100);
                        elements.importProgress.bar.style.width = `${percent}%`;
                        elements.importProgress.bar.textContent = `${percent}%`;
                        elements.importProgress.text.textContent = `Restaurando foto ${processedPhotos} de ${totalPhotos}...`;
                    }
                    
                    elements.importProgress.modal.classList.remove('show');
                }
                
                localStorage.setItem('inventarioProState', JSON.stringify(importedState));
                showToast('Sesión importada con éxito. Recargando aplicación...', 'success');
                setTimeout(() => window.location.reload(), 1500);

            } catch (err) {
                console.error("Error al importar la sesión:", err);
                showToast('Error fatal al importar el archivo de sesión.', 'error');
                overlay.classList.remove('show');
                elements.importProgress.modal.classList.remove('show');
            } finally {
                event.target.value = '';
            }
        });

        elements.settings.loadedListsContainer.addEventListener('click', (e) => {
            if (state.readOnlyMode) return;
            const deleteBtn = e.target.closest('.delete-list-btn');
            if (deleteBtn) {
                const listId = Number(deleteBtn.dataset.listId);
                const listToDelete = state.inventory.find(i => i.listId === listId);
                if (!listToDelete) return;
                const areaOriginal = listToDelete.areaOriginal;
                const affectedUsers = state.resguardantes.filter(u => u.area === areaOriginal);
                const affectedAdicionales = state.additionalItems.filter(item => 
                    affectedUsers.some(user => user.name === item.usuario)
                );
                if (affectedUsers.length > 0 || affectedAdicionales.length > 0) {
                    showReassignModal(listId, areaOriginal, affectedUsers, affectedAdicionales);
                } else {
                    showConfirmationModal('Eliminar Listado', `¿Seguro que quieres eliminar el listado del archivo "${listToDelete.fileName}"?`, () => {
                        deleteListAndRefresh(listId);
                    });
                }
            }
            const reprintBtn = e.target.closest('.reprint-area-report-btn');
            if(reprintBtn) {
                const areaId = reprintBtn.dataset.areaId;
                const closedAreaInfo = state.closedAreas[areaId];
                if (closedAreaInfo) {
                    showPreprintModal('area_closure', {
                        areaId,
                        responsible: closedAreaInfo.responsible,
                        location: closedAreaInfo.location
                    });
                } else {
                    showToast('Error: No se encontraron datos de cierre para esta área.', 'error');
                }
            }
        });
        
        let aboutClickCount = 0;
        elements.settings.aboutHeader.addEventListener('click', () => {
            aboutClickCount++;
            if (aboutClickCount >= 5) {
                elements.settings.aboutContent.classList.remove('hidden');
            }
        });
        
        elements.log.showBtn.addEventListener('click', () => {
            elements.log.content.textContent = state.activityLog.join('\n');
            elements.log.modal.classList.add('show');
        });
        elements.log.closeBtn.addEventListener('click', () => {
            elements.log.modal.classList.remove('show');
        });


        if (loadState()) {
            if (state.loggedIn) {
                showMainApp();
            } else {
                elements.loginPage.classList.remove('hidden');
                elements.mainApp.classList.add('hidden');
            }
        } else {
            elements.loginPage.classList.remove('hidden');
            elements.mainApp.classList.add('hidden');
        }
        
        const claveInput = document.getElementById('ad-clave');
        const serieInput = document.getElementById('ad-serie');
        const claveFeedback = document.getElementById('ad-clave-feedback');
        const serieFeedback = document.getElementById('ad-serie-feedback');

        const checkDuplicate = (value, feedbackElement) => {
            if (!value.trim()) {
                feedbackElement.textContent = '';
                return;
            }
            if (state.serialNumberCache.has(String(value).trim().toLowerCase())) {
                feedbackElement.textContent = 'Esta clave/serie ya existe en el inventario.';
            } else {
                feedbackElement.textContent = '';
            }
        };

        claveInput.addEventListener('input', debounce(() => {
            checkDuplicate(claveInput.value, claveFeedback);
        }, 400));

        serieInput.addEventListener('input', debounce(() => {
            checkDuplicate(serieInput.value, serieFeedback);
        }, 400));
        const inventoryTableBody = elements.inventory.tableBody;
        const photoPreviewPopover = document.getElementById('photo-preview-popover');
        const photoPreviewImg = document.getElementById('photo-preview-img');
        let currentPhotoUrl = null;
        let popoverTimeout;

        inventoryTableBody.addEventListener('mouseover', (e) => {
            const cameraIcon = e.target.closest('.camera-icon');
            if (!cameraIcon) return;
            
            clearTimeout(popoverTimeout); 

            const row = cameraIcon.closest('tr');
            const clave = row.dataset.clave;

            if (state.photos[clave]) {
                photoPreviewPopover.classList.remove('hidden');
                photoPreviewImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                
                photoDB.getItem(`inventory-${clave}`).then(imageBlob => {
                    if (!imageBlob) {
                        photoPreviewPopover.classList.add('hidden');
                        return;
                    };
                    if (currentPhotoUrl) {
                        URL.revokeObjectURL(currentPhotoUrl);
                    }
                    currentPhotoUrl = URL.createObjectURL(imageBlob);
                    photoPreviewImg.src = currentPhotoUrl;
                }).catch(err => {
                    console.error("Error al cargar la previsualización de la foto:", err);
                    photoPreviewPopover.classList.add('hidden');
                });
            }
        });

        inventoryTableBody.addEventListener('mouseout', (e) => {
            const cameraIcon = e.target.closest('.camera-icon');
            if (!cameraIcon) return;

            popoverTimeout = setTimeout(() => {
                photoPreviewPopover.classList.add('hidden');
                photoPreviewImg.src = '';
                if (currentPhotoUrl) {
                    URL.revokeObjectURL(currentPhotoUrl);
                    currentPhotoUrl = null;
                }
            }, 100);
        });
        const userSearchInput = document.getElementById('user-search-input');
        if (userSearchInput) {
            userSearchInput.addEventListener('input', renderUserList);
        }
        const importPhotosBtn = document.getElementById('import-photos-btn');
        const importPhotosInput = document.getElementById('import-photos-input');

        importPhotosBtn.addEventListener('click', () => {
            if (state.readOnlyMode) return showToast('Modo de solo lectura: no se pueden importar fotos.', 'warning');
            if (state.inventory.length === 0) return showToast('Carga un inventario antes de importar fotos.', 'error');
            importPhotosInput.click();
        });

        importPhotosInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;

            const { modal, text, bar } = elements.importProgress;
            modal.classList.add('show');
            text.textContent = 'Iniciando importación de fotos...';
            bar.style.width = '0%';
            bar.textContent = '0%';

            const inventoryClaves = new Set(state.inventory.map(item => String(item['CLAVE UNICA'])));
            let successCount = 0;
            let errorCount = 0;
            const totalFiles = files.length;

            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                const fileName = file.name;
                const clave = fileName.substring(0, fileName.lastIndexOf('.'));

                const percent = Math.round(((i + 1) / totalFiles) * 100);
                bar.style.width = `${percent}%`;
                bar.textContent = `${percent}%`;
                text.textContent = `Procesando ${i + 1} de ${totalFiles}: ${fileName}`;

                if (inventoryClaves.has(clave)) {
                    if (file.size > 2 * 1024 * 1024) {
                        console.warn(`Archivo ignorado (muy grande): ${fileName}`);
                        errorCount++;
                        continue;
                    }
                    try {
                        await photoDB.setItem(`inventory-${clave}`, file);
                        state.photos[clave] = true;
                        successCount++;
                    } catch (err) {
                        console.error(`Error al guardar la foto ${fileName}:`, err);
                        errorCount++;
                    }
                } else {
                    console.warn(`Archivo ignorado (clave no encontrada): ${fileName}`);
                    errorCount++;
                }
            }
            
            modal.classList.remove('show');
            
            if (successCount > 0) {
                saveState();
                filterAndRenderInventory();
                showToast(`Importación completa: ${successCount} fotos guardadas con éxito.`, 'success');
            }
            if (errorCount > 0) {
                showToast(`${errorCount} archivos fueron ignorados (clave no encontrada o archivo muy grande). Revisa la consola para más detalles.`, 'warning');
            }
            
            importPhotosInput.value = '';
        });
        const restorePhotosBtn = document.getElementById('restore-photos-from-backup-btn');
        const restorePhotosInput = document.getElementById('restore-photos-input');

        restorePhotosBtn.addEventListener('click', () => {
            if (state.readOnlyMode) return showToast('Modo de solo lectura activado.', 'warning');
            if (state.inventory.length === 0) return showToast('Carga un inventario antes de restaurar fotos.', 'error');
            restorePhotosInput.click();
        });

        restorePhotosInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const { modal, text, bar } = elements.importProgress;
            modal.classList.add('show');

            const inventoryClaves = new Set(state.inventory.map(item => String(item['CLAVE UNICA'])));
            let successCount = 0;
            let ignoredCount = 0;

            try {
                const jszip = new JSZip();
                const zip = await jszip.loadAsync(file);

                const photoFolder = zip.folder("photos");
                if (!photoFolder) {
                    modal.classList.remove('show');
                    return showToast('Error: El archivo .zip no contiene una carpeta de fotos válida.', 'error');
                }

                const photoFiles = [];
                photoFolder.forEach((relativePath, file) => {
                    if (!file.dir) photoFiles.push(file);
                });
                const totalPhotos = photoFiles.length;

                for (let i = 0; i < totalPhotos; i++) {
                    const photoFile = photoFiles[i];
                    const key = photoFile.name.split('/').pop();
                    const clave = key.replace('inventory-', '').replace('additional-', '').replace('location-','');
                    
                    const percent = Math.round(((i + 1) / totalPhotos) * 100);
                    bar.style.width = `${percent}%`;
                    bar.textContent = `${percent}%`;
                    text.textContent = `Restaurando foto ${i + 1} de ${totalPhotos}...`;

                    if (inventoryClaves.has(clave)) {
                        const blob = await photoFile.async("blob");
                        await photoDB.setItem(key, blob);
                        if (key.startsWith('inventory-')) state.photos[clave] = true;
                        if (key.startsWith('additional-')) state.additionalPhotos[clave] = true;
                        successCount++;
                    } else {
                        ignoredCount++;
                    }
                }

                modal.classList.remove('show');

                if (successCount > 0) {
                    saveState();
                    filterAndRenderInventory();
                    showToast(`${successCount} fotos restauradas y asociadas con éxito.`, 'success');
                }
                if (ignoredCount > 0) {
                    showToast(`${ignoredCount} fotos del backup fueron ignoradas porque sus claves no se encontraron en el inventario actual.`, 'warning');
                }
                if (successCount === 0 && ignoredCount === 0) {
                     showToast('No se encontraron fotos en el backup para procesar.', 'info');
                }

            } catch (err) {
                modal.classList.remove('show');
                console.error("Error al restaurar fotos desde el backup:", err);
                showToast('Error al procesar el archivo .zip. Asegúrate de que es un backup válido.', 'error');
            } finally {
                restorePhotosInput.value = '';
            }
        });

        elements.dashboard.dailyProgressCard.addEventListener('mouseenter', e => {
            const tooltip = elements.dashboard.progressTooltip;
            
            const progressByDate = [...state.inventory, ...state.additionalItems].reduce((acc, item) => {
                const dateStr = item.fechaUbicado || item.fechaRegistro;
                if (!dateStr) return acc;
                
                const date = dateStr.slice(0, 10);
                if (!acc[date]) {
                    acc[date] = { inventory: 0, additional: 0 };
                }
                if (item.fechaUbicado) acc[date].inventory++;
                if (item.fechaRegistro) acc[date].additional++;
                
                return acc;
            }, {});

            const sortedDates = Object.keys(progressByDate).sort((a, b) => new Date(b) - new Date(a));

            if (sortedDates.length === 0) return;

            let tooltipContent = '<h4>Progreso por Fecha</h4><ul>';
            sortedDates.forEach(date => {
                const { inventory, additional } = progressByDate[date];
                const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
                tooltipContent += `<li><strong>${formattedDate}:</strong> ${inventory} + ${additional}</li>`;
            });
            tooltipContent += '</ul>';
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.display = 'block';

            const rect = e.currentTarget.getBoundingClientRect();
            tooltip.style.left = `${rect.left}px`;
            tooltip.style.top = `${rect.bottom + 10}px`;
        });

        elements.dashboard.dailyProgressCard.addEventListener('mouseleave', () => {
            elements.dashboard.progressTooltip.style.display = 'none';
        });
        
        window.addEventListener('beforeunload', (event) => {
            if (state.loggedIn && !state.readOnlyMode) {
                event.preventDefault();
                event.returnValue = '';
            }
        });

        if (loadState()) {
            if (state.loggedIn) {
                showMainApp();
            } else {
                elements.loginPage.classList.remove('hidden');
                elements.mainApp.classList.add('hidden');
            }
        } else {
            elements.loginPage.classList.remove('hidden');
            elements.mainApp.classList.add('hidden');
        }
    }

    function renderReportTable(data, title, options = {}) {
        const { withCheckboxes = false, headers = [], isInstitutionalReport = false, reportType = null } = options; 
        const { tableContainer, tableTitle, tableBody } = elements.reports;
        const thead = tableContainer.querySelector('thead tr');

        tableTitle.textContent = title;
        tableTitle.classList.remove('hidden');
        tableContainer.classList.remove('hidden');
        
        thead.innerHTML = headers.map(h => `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center py-4 text-gray-500">No se encontraron bienes.</td></tr>`;
            return;
        }
        
        data.forEach(item => {
            const row = document.createElement('tr');
            let cells = '';
            const clave = item['CLAVE UNICA'];

            if (isInstitutionalReport) {
                const isChecked = state.institutionalReportCheckboxes[item.id] || false;
                cells = `
                    <td class="px-4 py-4"><input type="checkbox" class="rounded institutional-report-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
                    <td class="px-4 py-4 text-sm">${item.descripcion}</td>
                    <td class="px-4 py-4 text-sm">${item.clave || 'N/A'}</td>
                    <td class="px-4 py-4 text-sm">${item.area || 'N/A'}</td>
                    <td class="px-4 py-4 text-sm">${item.marca || 'N/A'}</td>
                    <td class="px-4 py-4 text-sm">${item.serie || 'N/A'}</td>
                    <td class="px-4 py-4 text-sm">${item.usuario}</td>
                    <td class="px-4 py-4">
                        <input type="text" value="${item.claveAsignada || ''}" placeholder="Asignar..." class="new-clave-input w-24 rounded-md border-gray-300 shadow-sm p-2 text-sm" data-id="${item.id}" autocomplete="off">
                    </td>
                    <td class="px-4 py-4">
                        <button class="save-new-clave-btn px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors bg-indigo-500 hover:bg-indigo-600" data-id="${item.id}">
                            <i class="fa-solid fa-save mr-1"></i> Guardar
                        </button>
                    </td>
                `;
            } else { 
                if (withCheckboxes && reportType) {
                    const isChecked = state.reportCheckboxes[reportType] ? (state.reportCheckboxes[reportType][clave] || false) : false;
                    cells += `<td class="px-4 py-4"><input type="checkbox" class="rounded report-item-checkbox" data-clave="${clave}" data-report-type="${reportType}" ${isChecked ? 'checked' : ''}></td>`;
                }
                if (headers.includes('Clave Única')) cells += `<td class="px-4 py-4">${clave}</td>`;
                if (headers.includes('Descripción')) cells += `<td class="px-4 py-4">${item['DESCRIPCION']}</td>`;
                if (headers.includes('Serie')) cells += `<td class="px-4 py-4">${item['SERIE'] || 'N/A'}</td>`;
                if (headers.includes('Usuario')) cells += `<td class="px-4 py-4">${item['NOMBRE DE USUARIO'] || 'N/A'}</td>`;
                if (headers.includes('Marca')) cells += `<td class="px-4 py-4">${item['MARCA'] || 'N/A'}</td>`;
                if (headers.includes('Modelo')) cells += `<td class="px-4 py-4">${item['MODELO'] || 'N/A'}</td>`;
                if (headers.includes('Ubicado')) cells += `<td class="px-4 py-4">${item['UBICADO'] || 'NO'}</td>`;
                if (headers.includes('Área Original')) cells += `<td class="px-4 py-4">${item.areaOriginal}</td>`;
                if (headers.includes('Nota')) cells += `<td class="px-4 py-4">${state.notes[clave] || 'N/A'}</td>`;
                if (headers.includes('Usuario/Área Actual')) {
                    const currentUser = state.resguardantes.find(u => u.name === item['NOMBRE DE USUARIO']);
                    cells += `<td class="px-4 py-4">${item['NOMBRE DE USUARIO']} (Área: ${currentUser?.area || 'N/A'})</td>`;
                }
            }
            
            row.innerHTML = cells;
            tableBody.appendChild(row);
        });
    }

    function showPreprintModal(reportType, data = {}) {
        const { modal, title, fieldsContainer, confirmBtn } = elements.preprintModal;
        let fieldsHtml = '';
        let defaultValues = {};
        let titleText = '';

        const selectedArea = elements.reports.areaFilter.value;
        const selectedUser = elements.reports.userFilter.value;
        const areaId = selectedArea !== 'all' ? selectedArea : (state.resguardantes.find(u => u.name === selectedUser)?.area || null);
        const areaResponsibleData = areaId ? state.areaDirectory[areaId] : null;


        switch (reportType) {
            case 'session_summary':
                titleText = 'Generar Resumen de Sesión';
                defaultValues = {
                    author: elements.settings.summaryAuthor.value.trim(),
                    areaResponsible: elements.settings.summaryAreaResponsible.value.trim(),
                    location: elements.settings.summaryLocation.value.trim()
                };
                fieldsHtml = `
                    <div><label class="block text-sm font-medium">Ubicación Física del Inventario:</label><input type="text" id="preprint-location" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.location}"></div>
                    <div><label class="block text-sm font-medium">Realizado por (Entrega):</label><input type="text" id="preprint-author" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.author}"></div>
                    <div><label class="block text-sm font-medium">Responsable del Área (Recibe):</label><input type="text" id="preprint-areaResponsible" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaResponsible}"></div>
                `;
                break;
            case 'area_closure':
                titleText = 'Generar Acta de Cierre de Área';
                defaultValues = {
                    areaId: data.areaId,
                    responsible: data.responsible,
                    location: data.location,
                    areaFullName: state.areaNames[data.areaId] || `Área ${data.areaId}`,
                    entrega: state.currentUser.name,
                    recibe: data.responsible,
                    recibeCargo: state.areaDirectory[data.areaId]?.name || 'Responsable de Área'
                };
                fieldsHtml = `
                    <div><label class="block text-sm font-medium">Nombre Completo del Área:</label><input type="text" id="preprint-areaFullName" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaFullName}"></div>
                    <div><label class="block text-sm font-medium">Ubicación de Firma:</label><input type="text" id="preprint-location" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.location}"></div>
                    <div><label class="block text-sm font-medium">Entrega (Inventario):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                    <div><label class="block text-sm font-medium">Recibe de Conformidad:</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
                    <div><label class="block text-sm font-medium">Cargo de Quien Recibe:</label><input type="text" id="preprint-recibeCargo" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibeCargo}"></div>
                `;
                break;
             case 'simple_pending':
                titleText = 'Imprimir Reporte de Pendientes';
                defaultValues = {
                    areaDisplay: selectedArea !== 'all' ? `${selectedArea} - ${state.areaNames[selectedArea] || 'Área Desconocida'}` : 'Todas las Áreas',
                    entrega: state.currentUser.name,
                    recibe: "_________________________"
                };
                fieldsHtml = `
                    <div><label class="block text-sm font-medium">Reporte para:</label><input type="text" id="preprint-areaDisplay" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaDisplay}"></div>
                    <div><label class="block text-sm font-medium">Realizó (Entrega):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                    <div><label class="block text-sm font-medium">Recibe Copia:</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
                `;
                break;
            case 'individual_resguardo':
            case 'adicionales_informe':
                titleText = 'Imprimir Resguardo';
                const isAdicional = reportType === 'adicionales_informe';
                let userForReport = selectedUser !== 'all' ? selectedUser : (isAdicional ? 'el Área' : 'Usuario');
                
                defaultValues = {
                    areaFullName: areaId !== 'all' && areaId ? (state.areaNames[areaId] || `Área ${areaId}`) : 'Todas las Áreas',
                    entrega: areaResponsibleData?.name || '_________________________',
                    recibe: userForReport,
                    recibeCargo: areaResponsibleData?.title || 'Responsable de Área'
                };
                
                fieldsHtml = `
                    <div><label class="block text-sm font-medium">Nombre Completo del Área:</label><input type="text" id="preprint-areaFullName" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaFullName}"></div>
                    <div><label class="block text-sm font-medium">Responsable del Área (Entrega):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                    <div><label class="block text-sm font-medium">Firma de Conformidad (Recibe):</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
                    <div><label class="block text-sm font-medium">Cargo de Quien Entrega:</label><input type="text" id="preprint-recibeCargo" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibeCargo}"></div>
                `;
                break;
            default:
                const reportConfig = {
                    'inventory': generateInventoryReport,
                    'tasks_report': generateTasksReport,
                    'labels': () => renderReportTable(state.inventory.filter(item => item['IMPRIMIR ETIQUETA'] === 'SI'), 'Reporte de Etiquetas', { withCheckboxes: true, reportType: 'labels', headers: ['Acción', 'Clave Única', 'Descripción', 'Usuario'] }),
                    'pending': () => renderReportTable(state.inventory.filter(item => item.UBICADO !== 'SI'), 'Reporte de Bienes Pendientes', { withCheckboxes: false, headers: ['Clave Única', 'Descripción', 'Serie', 'Área Original'] }),
                    'notes': () => renderReportTable(state.inventory.filter(item => state.notes[item['CLAVE UNICA']]), 'Reporte de Notas', { withCheckboxes: true, reportType: 'notes', headers: ['Acción', 'Clave Única', 'Descripción', 'Nota'] }),
                    'mismatched': () => renderReportTable(state.inventory.filter(item => item.areaIncorrecta), 'Reporte de Bienes Fuera de Área', { withCheckboxes: true, reportType: 'mismatched', headers: ['Acción', 'Clave Única', 'Descripción', 'Área Original', 'Usuario/Área Actual'] }),
                    'institutional_adicionales': generateInstitutionalAdicionalesReport
                };
                if (reportConfig[reportType]) {
                    reportConfig[reportType]();
                }
                return;
        }

        title.textContent = titleText;
        fieldsContainer.innerHTML = fieldsHtml;
        modal.classList.add('show');
        handleModalNavigation(modal);

        confirmBtn.onclick = () => {
            const updatedOptions = { ...defaultValues };
            const inputs = fieldsContainer.querySelectorAll('input');
            inputs.forEach(input => {
                const key = input.id.replace('preprint-', '');
                updatedOptions[key] = input.value;
            });

            switch (reportType) {
                case 'session_summary':
                    generateSessionSummary(updatedOptions);
                    break;
                case 'area_closure':
                    generateAreaClosureReport(updatedOptions);
                    break;
                 case 'simple_pending':
                    generateSimplePendingReport(updatedOptions);
                    break;
                case 'individual_resguardo':
                     if (!selectedUser || selectedUser === 'all') return showToast('Selecciona un usuario.', 'error');
                     const userItems = state.inventory.filter(item => item['NOMBRE DE USUARIO'] === selectedUser);
                     generatePrintableResguardo('Resguardo de Bienes Individual', updatedOptions.recibe, userItems, false, updatedOptions);
                     break;
                case 'adicionales_informe':
                    let itemsToPrint = state.additionalItems;
                    let reportTitle = selectedUser;

                    if (selectedArea !== 'all') {
                        const usersInArea = state.resguardantes.filter(u => u.area === selectedArea).map(u => u.name);
                        itemsToPrint = itemsToPrint.filter(item => usersInArea.includes(item.usuario));
                    }
                    if (selectedUser !== 'all') {
                        itemsToPrint = itemsToPrint.filter(item => item.usuario === selectedUser);
                    }
                    generatePrintableResguardo('Informe de Bienes Adicionales', updatedOptions.recibe, itemsToPrint, true, updatedOptions);
                    break;
            }
            modal.classList.remove('show');
        };
    }

    initialize();
});