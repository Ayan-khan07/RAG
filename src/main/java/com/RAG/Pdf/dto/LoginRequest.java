package com.RAG.Pdf.dto;

public record LoginRequest(
        String email,
        String password
) {
}