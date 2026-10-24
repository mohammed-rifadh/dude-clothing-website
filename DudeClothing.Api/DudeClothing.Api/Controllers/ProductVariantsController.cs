
using DudeClothing.Api.Models;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductVariantsController : ControllerBase
{
    private readonly ProductVariantRepository _repository;

    public ProductVariantsController(ProductVariantRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<ProductVariant>>> GetAll()
    {
        return Ok(await _repository.GetAllAsync());
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<ProductVariant>>> GetAllForAdmin()
    {
        return Ok(await _repository.GetAllAsync(includeInactive: true));
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<ProductVariant>> GetById(int id)
    {
        if (id <= 0)
            return BadRequest(new { message = "Variant ID must be positive." });

        var variant = await _repository.GetByIdAsync(id);

        if (variant is null)
            return NotFound(new { message = "Active product variant not found." });

        return Ok(variant);
    }

    [HttpGet("product/{productId:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<List<ProductVariant>>> GetByProductId(
        int productId)
    {
        if (productId <= 0)
            return BadRequest(new { message = "Product ID must be positive." });

        if (!await _repository.ProductExistsAsync(productId))
            return NotFound(new { message = "Active product not found." });

        return Ok(await _repository.GetByProductIdAsync(productId));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Create(
        [FromBody] ProductVariantWriteRequest request)
    {
        if (!await _repository.ProductExistsAsync(request.ProductId))
        {
            return BadRequest(new
            {
                message = "The selected product does not exist or is inactive."
            });
        }

        var sku = request.SKU.Trim();

        if (await _repository.SkuExistsAsync(sku))
            return Conflict(new { message = "This SKU already exists." });

        var id = await _repository.CreateAsync(Normalize(request));
        var variant = await _repository.GetByIdAsync(id);

        return CreatedAtAction(nameof(GetById), new { id }, variant);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] ProductVariantWriteRequest request)
    {
        if (id <= 0)
            return BadRequest(new { message = "Variant ID must be positive." });

        if (await _repository.GetByIdForAdminAsync(id) is null)
            return NotFound(new { message = "Product variant not found." });

        if (!await _repository.ProductExistsAsync(request.ProductId))
        {
            return BadRequest(new
            {
                message = "The selected product does not exist or is inactive."
            });
        }

        if (await _repository.SkuExistsAsync(request.SKU.Trim(), id))
            return Conflict(new { message = "This SKU already exists." });

        var updated = await _repository.UpdateAsync(id, Normalize(request));

        if (!updated)
            return NotFound(new { message = "Product variant not found." });

        return NoContent();
    }

    [HttpPatch("{id:int}/activation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetActivation(
        int id,
        [FromBody] ActivationRequest request)
    {
        if (id <= 0)
            return BadRequest(new { message = "Variant ID must be positive." });

        if (!request.IsActive.HasValue)
            return BadRequest(new { message = "isActive is required." });

        if (request.IsActive.Value)
        {
            var productId = await _repository.GetParentProductIdAsync(id);

            if (!productId.HasValue)
                return NotFound(new { message = "Product variant not found." });

            if (!await _repository.ProductExistsAsync(productId.Value))
            {
                return BadRequest(new
                {
                    message = "Activate the parent product before activating this variant."
                });
            }
        }

        var updated = await _repository.SetActiveAsync(
            id, request.IsActive.Value);

        if (!updated)
            return NotFound(new { message = "Product variant not found." });

        return Ok(new
        {
            variantId = id,
            isActive = request.IsActive.Value,
            message = request.IsActive.Value
                ? "Product variant activated successfully."
                : "Product variant deactivated successfully."
        });
    }

    [HttpPatch("{id:int}/stock")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStock(
        int id,
        [FromBody] StockUpdateRequest request)
    {
        if (id <= 0)
            return BadRequest(new { message = "Variant ID must be positive." });

        if (request.StockQuantity < 0)
            return BadRequest(new { message = "Stock cannot be negative." });

        var updated = await _repository.UpdateStockAsync(
            id, request.StockQuantity);

        if (!updated)
            return NotFound(new { message = "Active product variant not found." });

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id <= 0)
            return BadRequest(new { message = "Variant ID must be positive." });

        var deleted = await _repository.DeactivateAsync(id);

        if (!deleted)
            return NotFound(new { message = "Active product variant not found." });

        return NoContent();
    }

    private static ProductVariantWriteRequest Normalize(
        ProductVariantWriteRequest request)
    {
        return new ProductVariantWriteRequest
        {
            ProductId = request.ProductId,
            SKU = request.SKU.Trim(),
            Size = request.Size.Trim(),
            Colour = request.Colour.Trim(),
            StockQuantity = request.StockQuantity
        };
    }
}
