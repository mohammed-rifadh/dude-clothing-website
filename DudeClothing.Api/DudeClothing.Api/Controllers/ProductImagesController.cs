
using DudeClothing.Api.Models;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductImagesController : ControllerBase
{
    private readonly ProductImageRepository _repository;

    public ProductImagesController(ProductImageRepository repository)
    {
        _repository = repository;
    }

    // GET: api/ProductImages
    // Public: view product images.
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<ProductImage>>> GetAll()
    {
        var images = await _repository.GetAllAsync();

        return Ok(images);
    }

    // GET: api/ProductImages/1
    // Public: view a specific image.
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<ProductImage>> GetById(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Image ID must be a positive number."
            });
        }

        var image = await _repository.GetByIdAsync(id);

        if (image is null)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        return Ok(image);
    }

    // GET: api/ProductImages/product/1
    // Public: view images belonging to a product.
    [HttpGet("product/{productId:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<List<ProductImage>>> GetByProductId(
        int productId)
    {
        if (productId <= 0)
        {
            return BadRequest(new
            {
                message = "Product ID must be a positive number."
            });
        }

        if (!await _repository.ProductExistsAsync(productId))
        {
            return NotFound(new
            {
                message = "Active product not found."
            });
        }

        var images = await _repository.GetByProductIdAsync(productId);

        return Ok(images);
    }

    // POST: api/ProductImages
    // Admin only: add an image.
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Create(
        [FromBody] ProductImageWriteRequest request)
    {
        if (!await _repository.ProductExistsAsync(request.ProductId))
        {
            return BadRequest(new
            {
                message = "The selected product does not exist or is inactive."
            });
        }

        var normalizedRequest = new ProductImageWriteRequest
        {
            ProductId = request.ProductId,
            ImageUrl = request.ImageUrl.Trim(),
            AltText = request.AltText?.Trim(),
            IsPrimary = request.IsPrimary,
            SortOrder = request.SortOrder
        };

        var imageId = await _repository.CreateAsync(normalizedRequest);

        var createdImage = await _repository.GetByIdAsync(imageId);

        return CreatedAtAction(
            nameof(GetById),
            new { id = imageId },
            createdImage);
    }

    // PUT: api/ProductImages/1
    // Admin only: update image details.
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] ProductImageUpdateRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Image ID must be a positive number."
            });
        }

        var existingImage = await _repository.GetByIdAsync(id);

        if (existingImage is null)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        var normalizedRequest = new ProductImageUpdateRequest
        {
            ImageUrl = request.ImageUrl.Trim(),
            AltText = request.AltText?.Trim(),
            SortOrder = request.SortOrder
        };

        var updated = await _repository.UpdateAsync(id, normalizedRequest);

        if (!updated)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        return NoContent();
    }

    // PATCH: api/ProductImages/1/primary
    // Admin only: choose the primary image.
    [HttpPatch("{id:int}/primary")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetPrimary(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Image ID must be a positive number."
            });
        }

        var updated = await _repository.SetPrimaryAsync(id);

        if (!updated)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        return NoContent();
    }

    // PATCH: api/ProductImages/1/sort-order
    // Admin only: change image display order.
    [HttpPatch("{id:int}/sort-order")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSortOrder(
        int id,
        [FromBody] UpdateImageSortOrderRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Image ID must be a positive number."
            });
        }

        var existingImage = await _repository.GetByIdAsync(id);

        if (existingImage is null)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        var updated = await _repository.UpdateSortOrderAsync(
            id, request.SortOrder);

        if (!updated)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        return NoContent();
    }

    // DELETE: api/ProductImages/1
    // Admin only: permanently delete an image.
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Image ID must be a positive number."
            });
        }

        var deleted = await _repository.DeleteAsync(id);

        if (!deleted)
        {
            return NotFound(new
            {
                message = "Product image not found."
            });
        }

        return NoContent();
    }
}
