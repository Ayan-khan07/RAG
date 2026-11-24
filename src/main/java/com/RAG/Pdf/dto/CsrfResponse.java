package com.RAG.Pdf.dto;

public record CsrfResponse(
        String headerName,
        String token
) {
}