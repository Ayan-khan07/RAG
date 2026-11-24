package com.RAG.Pdf.dto;

public record AuthResponse(
        Long id,
        String name,
        String email,
        String role
) {
}