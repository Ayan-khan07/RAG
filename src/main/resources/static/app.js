/* PAPERLY frontend
 * Spring Boot endpoints used:
 *   POST /api/documents/upload  (multipart field: file)
 *   POST /api/chat              (JSON body: { "question": "..." })
 */
(() => {
    'use strict';

    const API = {
        upload: '/api/documents/upload',
        chat: '/api/chat'
    };
    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    const $ = (selector) => document.querySelector(selector);
    const elements = {
        today: $('#today-label'),
        mobileMenu: $('#mobile-menu'),
        sidebar: $('#sidebar'),
        pdfInput: $('#pdf-input'),
        dropzone: $('#dropzone'),
        browse: $('#browse-btn'),
        selectedFile: $('#selected-file'),
        selectedFileName: $('#selected-file-name'),
        removeFile: $('#remove-file'),
        uploadButton: $('#upload-btn'),
        uploadProgress: $('#upload-progress'),
        progressFill: $('#progress-fill'),
        progressLabel: $('#progress-label'),
        uploadFeedback: $('#upload-feedback'),
        documentsPanel: $('#documents-panel'),
        documentList: $('#document-list'),
        documentTotal: $('#doc-total'),
        navDocCount: $('#nav-doc-count'),
        contextLabel: $('#context-label'),
        chatForm: $('#chat-form'),
        questionInput: $('#question-input'),
        sendButton: $('#send-btn'),
        chatMessages: $('#chat-messages'),
        emptyChat: $('#empty-chat'),
        clearChat: $('#clear-chat-btn'),
        newChat: $('#new-chat-btn'),
        toastRegion: $('#toast-region')
    };

    let selectedFile = null;
    let isUploading = false;
    let isSending = false;
    let uploadedDocuments = [];

    // Display today's date using the visitor's local timezone.
    elements.today.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
    }).format(new Date());

    function showToast(message, type = 'default') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        elements.toastRegion.appendChild(toast);
        window.setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(6px)';
            window.setTimeout(() => toast.remove(), 220);
        }, 3200);
    }

    function setUploadFeedback(message, type = 'success') {
        elements.uploadFeedback.hidden = false;
        elements.uploadFeedback.className = `upload-feedback ${type}`;
        elements.uploadFeedback.textContent = message;
    }

    function clearUploadFeedback() {
        elements.uploadFeedback.hidden = true;
        elements.uploadFeedback.textContent = '';
        elements.uploadFeedback.className = 'upload-feedback';
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function getErrorMessage(payload, fallback) {
        if (typeof payload === 'string' && payload.trim()) return payload;
        if (payload && typeof payload === 'object') {
            return payload.message || payload.error || payload.detail || payload.title || fallback;
        }
        return fallback;
    }

    async function readResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try { return await response.json(); } catch (_) { return null; }
        }
        try { return await response.text(); } catch (_) { return null; }
    }

    function selectFile(file) {
        clearUploadFeedback();
        if (!file) return;

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            showToast('Please choose a PDF file.', 'error');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showToast('This PDF is larger than 20 MB. Please choose a smaller file.', 'error');
            return;
        }
        selectedFile = file;
        elements.selectedFile.hidden = false;
        elements.selectedFileName.textContent = `${file.name} · ${formatBytes(file.size)}`;
        elements.uploadButton.disabled = isUploading;
        elements.uploadButton.querySelector('span').textContent = 'Upload PDF';
    }

    function resetSelectedFile() {
        if (isUploading) return;
        selectedFile = null;
        elements.pdfInput.value = '';
        elements.selectedFile.hidden = true;
        elements.uploadButton.disabled = true;
        elements.uploadProgress.hidden = true;
    }

    function setProgress(percent) {
        const safePercent = Math.max(0, Math.min(100, percent));
        elements.uploadProgress.hidden = false;
        elements.progressFill.style.width = `${safePercent}%`;
        elements.progressLabel.textContent = safePercent >= 100 ? 'Processing PDF…' : `Uploading… ${Math.round(safePercent)}%`;
    }

    function extractDocumentName(payload, fallbackName) {
        if (payload && typeof payload === 'object') {
            return payload.fileName || payload.filename || payload.originalFilename || payload.name || fallbackName;
        }
        return fallbackName;
    }

    function extractDocumentDetail(payload) {
        if (!payload || typeof payload !== 'object') return 'Added to your knowledge base';
        const details = [];
        const pageCount = payload.pageCount ?? payload.pages;
        const chunkCount = payload.chunkCount ?? payload.chunks ?? payload.sourcesCount;
        if (Number.isFinite(Number(pageCount))) details.push(`${pageCount} pages`);
        if (Number.isFinite(Number(chunkCount))) details.push(`${chunkCount} chunks`);
        return details.length ? details.join(' · ') : (payload.message || payload.status || 'Added to your knowledge base');
    }

    function renderDocuments() {
        elements.documentList.replaceChildren();
        elements.documentsPanel.hidden = uploadedDocuments.length === 0;
        elements.navDocCount.textContent = String(uploadedDocuments.length);
        elements.documentTotal.textContent = `${uploadedDocuments.length} ${uploadedDocuments.length === 1 ? 'file' : 'files'}`;

        uploadedDocuments.forEach((doc) => {
            const item = document.createElement('div');
            item.className = 'document-item';
            const icon = document.createElement('div');
            icon.className = 'document-item-icon';
            icon.textContent = 'PDF';
            const copy = document.createElement('div');
            copy.className = 'document-item-copy';
            const name = document.createElement('strong');
            name.textContent = doc.name;
            name.title = doc.name;
            const detail = document.createElement('small');
            detail.textContent = `${formatBytes(doc.size)} · ${doc.detail}`;
            copy.append(name, detail);
            const status = document.createElement('span');
            status.className = 'document-status';
            const statusDot = document.createElement('i');
            status.append(statusDot, document.createTextNode('Ready'));
            item.append(icon, copy, status);
            elements.documentList.appendChild(item);
        });
    }

    function uploadPdf() {
        if (!selectedFile || isUploading) return;
        isUploading = true;
        clearUploadFeedback();
        elements.uploadButton.disabled = true;
        elements.uploadButton.querySelector('span').textContent = 'Uploading…';
        elements.progressFill.style.width = '0%';
        elements.progressLabel.textContent = 'Uploading… 0%';
        elements.uploadProgress.hidden = false;

        const formData = new FormData();
        formData.append('file', selectedFile);
        const fileBeingUploaded = selectedFile;
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API.upload, true);
        xhr.withCredentials = true;

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) setProgress((event.loaded / event.total) * 100);
        });

        xhr.addEventListener('load', () => {
            isUploading = false;
            let payload = null;
            try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; }
            catch (_) { payload = xhr.responseText; }

            if (xhr.status >= 200 && xhr.status < 300) {
                elements.progressFill.style.width = '100%';
                elements.progressLabel.textContent = 'PDF processed successfully';
                const name = extractDocumentName(payload, fileBeingUploaded.name);
                uploadedDocuments.unshift({
                    name,
                    size: fileBeingUploaded.size,
                    detail: extractDocumentDetail(payload),
                    addedAt: new Date()
                });
                renderDocuments();
                elements.contextLabel.textContent = `${uploadedDocuments.length} PDF${uploadedDocuments.length === 1 ? '' : 's'} in this session`;
                setUploadFeedback(`${name} was uploaded successfully and is ready for questions.`, 'success');
                showToast('Your PDF is ready to explore.', 'success');
                selectedFile = null;
                elements.pdfInput.value = '';
                elements.selectedFile.hidden = true;
                elements.uploadButton.querySelector('span').textContent = 'Upload PDF';
                elements.uploadButton.disabled = true;
                window.setTimeout(() => { elements.uploadProgress.hidden = true; }, 1800);
            } else {
                const message = getErrorMessage(payload, `Upload failed (HTTP ${xhr.status}).`);
                setUploadFeedback(message, 'error');
                showToast(message, 'error');
                elements.uploadButton.disabled = !selectedFile;
                elements.uploadButton.querySelector('span').textContent = 'Try again';
                elements.progressLabel.textContent = 'Upload failed';
            }
        });

        xhr.addEventListener('error', () => {
            isUploading = false;
            const message = 'Could not reach the upload API. Open this page through your Spring Boot app (for example, http://localhost:8080).';
            setUploadFeedback(message, 'error');
            showToast('Network error while uploading the PDF.', 'error');
            elements.uploadButton.disabled = !selectedFile;
            elements.uploadButton.querySelector('span').textContent = 'Try again';
            elements.progressLabel.textContent = 'Connection error';
        });

        xhr.addEventListener('abort', () => {
            isUploading = false;
            elements.uploadButton.disabled = !selectedFile;
            elements.uploadButton.querySelector('span').textContent = 'Upload PDF';
        });

        xhr.send(formData);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function inlineMarkdown(value) {
        let safe = escapeHtml(value);
        safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
        safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');
        return safe;
    }

    // A small, safe Markdown renderer for common AI answer formatting.
    // All model text is HTML-escaped before markup is added.
    function renderAnswerMarkdown(markdown) {
        const lines = String(markdown ?? '').replace(/\r/g, '').split('\n');
        const html = [];
        let listType = null;
        let codeLines = [];
        let inCode = false;

        const closeList = () => {
            if (listType) { html.push(`</${listType}>`); listType = null; }
        };
        const closeCode = () => {
            html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
            codeLines = [];
            inCode = false;
        };

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (line.trim().startsWith('```')) {
                closeList();
                if (inCode) closeCode(); else inCode = true;
                continue;
            }
            if (inCode) { codeLines.push(line); continue; }
            if (!line.trim()) { closeList(); continue; }

            const heading = line.match(/^#{1,3}\s+(.+)$/);
            const unordered = line.match(/^\s*[-*]\s+(.+)$/);
            const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
            if (heading) {
                closeList();
                html.push(`<h3>${inlineMarkdown(heading[1])}</h3>`);
            } else if (unordered || ordered) {
                const nextType = unordered ? 'ul' : 'ol';
                if (listType !== nextType) { closeList(); html.push(`<${nextType}>`); listType = nextType; }
                html.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
            } else {
                closeList();
                html.push(`<p>${inlineMarkdown(line)}</p>`);
            }
        }
        closeList();
        if (inCode) closeCode();
        return html.join('');
    }

    function timestamp() {
        return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
    }

    function addMessage(role, content, options = {}) {
        if (!elements.emptyChat.hidden) elements.emptyChat.hidden = true;

        const row = document.createElement('div');
        row.className = `message-row ${role}`;
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'assistant' ? '✦' : 'A';

        const body = document.createElement('div');
        body.className = 'message-body';
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        const author = document.createElement('span');
        author.textContent = role === 'assistant' ? 'PAPERLY' : 'YOU';
        const time = document.createElement('span');
        time.textContent = timestamp();
        meta.append(author, time);

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (options.typing) {
            bubble.innerHTML = '<span class="typing-dots" aria-label="PAPERLY is thinking"><i></i><i></i><i></i></span>';
        } else if (role === 'assistant') {
            bubble.innerHTML = renderAnswerMarkdown(content);
        } else {
            bubble.textContent = content;
        }

        body.append(meta, bubble);
        if (role === 'assistant' && Number.isFinite(options.sourcesCount) && options.sourcesCount > 0) {
            const source = document.createElement('div');
            source.className = 'message-sources';
            source.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 16h4"/></svg>';
            source.appendChild(document.createTextNode(`${options.sourcesCount} source${options.sourcesCount === 1 ? '' : 's'} referenced`));
            body.appendChild(source);
        }
        row.append(avatar, body);
        elements.chatMessages.appendChild(row);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        return row;
    }

    function setComposerBusy(busy) {
        isSending = busy;
        elements.questionInput.disabled = busy;
        elements.sendButton.disabled = busy || !elements.questionInput.value.trim();
        elements.sendButton.innerHTML = busy
            ? '<span class="typing-dots"><i></i><i></i><i></i></span>'
            : '<svg viewBox="0 0 24 24"><path d="m21 3-7.5 18-3.7-7.8L2 9.5 21 3Z"/><path d="M21 3 9.8 13.2"/></svg>';
    }

    async function sendQuestion(question) {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion || isSending) return;

        addMessage('user', trimmedQuestion);
        elements.questionInput.value = '';
        autoResizeTextarea();
        setComposerBusy(true);
        const thinkingRow = addMessage('assistant', '', { typing: true });

        try {
            const response = await fetch(API.chat, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ question: trimmedQuestion })
            });
            const payload = await readResponse(response);
            if (!response.ok) {
                throw new Error(getErrorMessage(payload, `Chat request failed (HTTP ${response.status}).`));
            }

            const answer = payload && typeof payload === 'object'
                ? (payload.answer ?? payload.content ?? payload.response ?? '')
                : payload;
            if (!String(answer ?? '').trim()) {
                throw new Error('The chat API returned an empty answer. Check that RagService returns the answer field.');
            }
            const rawSources = payload && typeof payload === 'object'
                ? (payload.sourcesCount ?? payload.sourceCount ?? payload.sources ?? 0)
                : 0;
            const sourcesCount = Number(rawSources);
            thinkingRow.remove();
            addMessage('assistant', String(answer), {
                sourcesCount: Number.isFinite(sourcesCount) ? sourcesCount : 0
            });
        } catch (error) {
            thinkingRow.remove();
            const message = error instanceof Error ? error.message : 'Something went wrong while contacting the chat API.';
            addMessage('assistant', `I couldn't get an answer from the backend.\n\n**${message}**\n\nCheck that Spring Boot is running and that /api/chat is available.`, {});
            showToast('Chat request failed. Check the backend response.', 'error');
        } finally {
            setComposerBusy(false);
            elements.questionInput.focus();
            elements.contextLabel.textContent = uploadedDocuments.length
                ? `${uploadedDocuments.length} PDF${uploadedDocuments.length === 1 ? '' : 's'} in this session`
                : 'Ready for your questions';
        }
    }

    function autoResizeTextarea() {
        elements.questionInput.style.height = 'auto';
        elements.questionInput.style.height = `${Math.min(elements.questionInput.scrollHeight, 120)}px`;
        elements.sendButton.disabled = isSending || !elements.questionInput.value.trim();
    }

    function clearConversation() {
        elements.chatMessages.querySelectorAll('.message-row').forEach((message) => message.remove());
        elements.emptyChat.hidden = false;
        elements.questionInput.value = '';
        autoResizeTextarea();
        showToast('Conversation cleared. Your uploaded PDFs are still available.');
    }

    // File picker and drag-and-drop.
    elements.browse.addEventListener('click', (event) => {
        event.stopPropagation();
        elements.pdfInput.click();
    });
    elements.dropzone.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        if (!isUploading) elements.pdfInput.click();
    });
    elements.dropzone.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === elements.dropzone) {
            event.preventDefault();
            elements.pdfInput.click();
        }
    });
    elements.pdfInput.addEventListener('change', () => selectFile(elements.pdfInput.files[0]));
    elements.removeFile.addEventListener('click', resetSelectedFile);
    elements.uploadButton.addEventListener('click', uploadPdf);

    ['dragenter', 'dragover'].forEach((eventName) => {
        elements.dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            if (!isUploading) elements.dropzone.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
        elements.dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            elements.dropzone.classList.remove('dragover');
        });
    });
    elements.dropzone.addEventListener('drop', (event) => {
        if (isUploading) return;
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        selectFile(file);
    });

    // Chat events.
    elements.chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        sendQuestion(elements.questionInput.value);
    });
    elements.questionInput.addEventListener('input', autoResizeTextarea);
    elements.questionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!elements.sendButton.disabled) elements.chatForm.requestSubmit();
        }
    });
    document.querySelectorAll('.suggestion').forEach((button) => {
        button.addEventListener('click', () => {
            elements.questionInput.value = button.dataset.prompt || '';
            autoResizeTextarea();
            sendQuestion(elements.questionInput.value);
        });
    });
    elements.clearChat.addEventListener('click', clearConversation);
    elements.newChat.addEventListener('click', () => {
        clearConversation();
        document.querySelector('#chat-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Section navigation.
    document.querySelectorAll('[data-scroll]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = document.getElementById(button.dataset.scroll);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === button));
            elements.sidebar.classList.remove('open');
        });
    });
    elements.mobileMenu.addEventListener('click', () => elements.sidebar.classList.toggle('open'));
    document.addEventListener('click', (event) => {
        if (window.innerWidth <= 800 && elements.sidebar.classList.contains('open')
            && !elements.sidebar.contains(event.target) && !elements.mobileMenu.contains(event.target)) {
            elements.sidebar.classList.remove('open');
        }
    });
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            elements.questionInput.focus();
        }
        if (event.key === 'Escape') elements.sidebar.classList.remove('open');
    });
})();
