package com.RAG.Pdf.dto;

public record UploadRequest(
        String filename,
        int totalPages,
        int totalChunks
) {

}
