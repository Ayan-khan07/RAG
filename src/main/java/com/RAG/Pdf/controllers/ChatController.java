package com.RAG.Pdf.controllers;

import com.RAG.Pdf.dto.ChatRequest;
import com.RAG.Pdf.dto.ChatResponse;
import com.RAG.Pdf.service.RagService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private final RagService ragService;
    public ChatController(RagService ragService) {
        this.ragService = ragService;
    }

    @PostMapping
    public ChatResponse chat (@RequestBody ChatRequest chatRequest){
        return ragService.askQuestion(chatRequest.question());
    }

}
