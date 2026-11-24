package com.RAG.Pdf.controllers;

import com.RAG.Pdf.dto.AuthResponse;
import com.RAG.Pdf.dto.CsrfResponse;
import com.RAG.Pdf.dto.LoginRequest;
import com.RAG.Pdf.dto.RegisterRequest;
import com.RAG.Pdf.security.AppUserPrincipal;
import com.RAG.Pdf.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;

    public AuthController(
            AuthService authService,
            AuthenticationManager authenticationManager,
            SecurityContextRepository securityContextRepository,
            SessionAuthenticationStrategy sessionAuthenticationStrategy
    ) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
    }

    // 1. Register
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @RequestBody RegisterRequest request
    ) {
        AuthResponse response = authService.register(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 2. Login
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {

        if (request == null ||
                request.email() == null ||
                request.email().isBlank() ||
                request.password() == null) {

            return ResponseEntity.badRequest().build();
        }

        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        Authentication authentication;

        try {
            Authentication authenticationRequest =
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            email,
                            request.password()
                    );

            authentication = authenticationManager.authenticate(
                    authenticationRequest
            );

        } catch (AuthenticationException exception) {
        throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid email or password"
        );
    }

        // Apply session fixation protection
        sessionAuthenticationStrategy.onAuthentication(
                authentication,
                httpRequest,
                httpResponse
        );

        // Create authenticated SecurityContext
        SecurityContext context =
                SecurityContextHolder.createEmptyContext();

        context.setAuthentication(authentication);

        SecurityContextHolder.setContext(context);

        // IMPORTANT: persist login in HTTP session
        securityContextRepository.saveContext(
                context,
                httpRequest,
                httpResponse
        );

        AppUserPrincipal principal =
                (AppUserPrincipal) authentication.getPrincipal();

        AuthResponse response = new AuthResponse(
                principal.getId(),
                principal.getName(),
                principal.getEmail(),
                principal.getRole()
        );

        return ResponseEntity.ok(response);
    }

    // 3. Get CSRF token
    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {

        return new CsrfResponse(
                csrfToken.getHeaderName(),
                csrfToken.getToken()
        );
    }

    // 4. Get currently logged-in user
    @GetMapping("/me")
    public AuthResponse currentUser(
            @AuthenticationPrincipal AppUserPrincipal principal
    ) {

        return new AuthResponse(
                principal.getId(),
                principal.getName(),
                principal.getEmail(),
                principal.getRole()
        );
    }
}