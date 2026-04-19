package com.shopnative.orderservice.client;

import com.shopnative.orderservice.dto.ProductDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProductServiceClient {

    private final RestClient restClient;

    @Value("${app.services.product-service-url}")
    private String productServiceUrl;

    public ProductDto getProduct(UUID productId) {
        try {
            return restClient.get()
                    .uri(productServiceUrl + "/api/products/{id}", productId)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        throw new RuntimeException("Product not found: " + productId);
                    })
                    .body(ProductDto.class);
        } catch (RuntimeException e) {
            log.error("Failed to fetch product {}: {}", productId, e.getMessage());
            throw e;
        }
    }
}
