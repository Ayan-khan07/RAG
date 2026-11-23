package com.RAG.Pdf.controllers;

import com.RAG.Pdf.dto.UploadRequest;
import com.RAG.Pdf.service.DocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.awt.*;
import java.io.IOException;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {


    private DocumentService documentService;
    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public UploadRequest uploadPdf(@RequestParam("file") MultipartFile file) throws IOException {

        UploadRequest result  =  documentService.uploadPdf(file);
        return result;
    }
}
