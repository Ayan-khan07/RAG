package com.RAG.Pdf.service;

import com.RAG.Pdf.dto.UploadRequest;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DocumentService {
    private final VectorStore vectorStore;

    public DocumentService(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }
     public UploadRequest  uploadPdf(MultipartFile file) throws IOException {
        if(file==null || file.isEmpty()){
            throw new IllegalArgumentException("please input file");
        }
       String filename =  file.getOriginalFilename();
        if(filename==null || !filename.endsWith(".pdf")){
            throw new IllegalArgumentException("please upload pdf file");
         }
         ByteArrayResource resource = new ByteArrayResource(file.getBytes());
         PagePdfDocumentReader reader = new PagePdfDocumentReader(resource);
         List<Document> pages = reader.read();
         if(pages.isEmpty()){
             throw new IllegalArgumentException("No readable data found");
         }
         List<Document> documents = new ArrayList<>();

         for (Document page : pages) {
             Map<String,Object> metadata = new HashMap<>(page.getMetadata());
             metadata.put("source",filename);
             Document document = new Document(page.getText(),metadata);
             documents.add(document);
         }

         TokenTextSplitter splitter = TokenTextSplitter.builder()
                 .withChunkSize(800)
                 .withMaxNumChunks(10000)
                 .withKeepSeparator(true)
                 .withMinChunkLengthToEmbed(5)
                 .build();
        List<Document> chunks = splitter.split(documents);
         vectorStore.add(chunks);

         return new UploadRequest(
                 filename,
                 pages.size(),
                 chunks.size()
         );

     }
}
