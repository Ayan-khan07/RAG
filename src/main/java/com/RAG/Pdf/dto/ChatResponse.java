package com.RAG.Pdf.dto;

public record ChatResponse(
        String question,
        String answer,
        int numChunks
) {
}
