
using DudeClothing.Api.Models;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductsController : ControllerBase
{
    private readonly ProductRepository _productRepository;

    public ProductsController(ProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    // Public: active products only.
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<Product>>> GetAll(
        [FromQuery] int? categoryId,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? term,
        [FromQuery] string? sortBy = "ProductId",
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (categoryId is <= 0 ||
            minPrice is < 0 ||
            maxPrice is < 0 ||
            (minPrice.HasValue &&
             maxPrice.HasValue &&
             minPrice.Value > maxPrice.Value))
        {
            return BadRequest(new
            {
                message = "Invalid category or price range."
            });
        }

        if (page < 1 || pageSize < 1 || pageSize > 100)
        {
            return BadRequest(new
            {
                message = "Page must be at least 1 and pageSize must be between 1 and 100."
            });
        }

        var products = await _productRepository.GetAllAsync(
            categoryId, minPrice, maxPrice, term,
            sortBy, sortDirection, page, pageSize);

        return Ok(products);
    }

    // Admin: active and inactive products.
    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<Product>>> GetAllForAdmin(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100)
        {
            return BadRequest(new
            {
                message = "Page must be positive and pageSize must be between 1 and 100."
            });
        }

        var products = await _productRepository.GetAllAsync(
            page: page,
            pageSize: pageSize,
            includeInactive: true);

        return Ok(products);
    }

    // Public: active product details.
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<Product>> GetById(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new { message = "Product ID must be positive." });
        }

        var product = await _productRepository.GetByIdAsync(id);

        if (product is null)
        {
            return NotFound(new { message = "Product not found." });
        }

        return Ok(product);
    }

    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<ActionResult<List<Product>>> Search(
        [FromQuery] string term,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (string.IsNullOrWhiteSpace(term))
        {
            return BadRequest(new { message = "Search term is required." });
        }

        if (page < 1 || pageSize < 1 || pageSize > 100)
        {
            return BadRequest(new { message = "Invalid pagination values." });
        }

        var products = await _productRepository.GetAllAsync(
            term: term,
            page: page,
            pageSize: pageSize);

        return Ok(products);
    }

    [HttpGet("category/{categoryId:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<List<Product>>> GetByCategory(
        int categoryId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (categoryId <= 0)
        {
            return BadRequest(new { message = "Category ID must be positive." });
        }

        if (page < 1 || pageSize < 1 || pageSize > 100)
        {
            return BadRequest(new { message = "Invalid pagination values." });
        }

        var products = await _productRepository.GetAllAsync(
            categoryId: categoryId,
            page: page,
            pageSize: pageSize);

        return Ok(products);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Create(
        [FromBody] ProductWriteRequest request)
    {
        var productId = await _productRepository.CreateAsync(request);

        return CreatedAtAction(
            nameof(GetById),
            new { id = productId },
            new
            {
                productId,
                message = "Product created successfully."
            });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] ProductWriteRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new { message = "Product ID must be positive." });
        }

        var updated = await _productRepository.UpdateAsync(id, request);

        if (!updated)
        {
            return NotFound(new { message = "Active product not found." });
        }

        return NoContent();
    }

    // Activate or deactivate a product.
    [HttpPatch("{id:int}/activation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetActivation(
        int id,
        [FromBody] ActivationRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new { message = "Product ID must be positive." });
        }

        if (!request.IsActive.HasValue)
        {
            return BadRequest(new { message = "isActive is required." });
        }

        var updated = await _productRepository.SetActiveAsync(
            id, request.IsActive.Value);

        if (!updated)
        {
            return NotFound(new { message = "Product not found." });
        }

        return Ok(new
        {
            productId = id,
            isActive = request.IsActive.Value,
            message = request.IsActive.Value
                ? "Product activated successfully."
                : "Product deactivated successfully."
        });
    }

    // Backward-compatible soft-deactivation endpoint.
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new { message = "Product ID must be positive." });
        }

        var deleted = await _productRepository.DeactivateAsync(id);

        if (!deleted)
        {
            return NotFound(new { message = "Product not found." });
        }

        return NoContent();
    }
}
