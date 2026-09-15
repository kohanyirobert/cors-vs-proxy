package com.codecool.corsdemo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RegisterController {

    private static final Logger log = LoggerFactory.getLogger(RegisterController.class);

    @PostMapping("/api/register")
    public String register() {
        log.info("Got POST!");
        return "Received POST!";
    }
}
