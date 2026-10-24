
using DudeClothing.Api.Models;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class CategoriesController : ControllerBase
{
    private readonly CategoryRepository _categoryRepository;

    public CategoriesController(CategoryRepository categoryRepository)
    {
        _categoryRepository = categoryRepository;
    }

    // GET: api/Categories
    // Returns active categories for public users.
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<Category>>> GetAll()
    {
        var categories = await _categoryRepository.GetAllAsync();

        return Ok(categories);
    }

    // GET: api/Categories/admin
    // Returns active and inactive categories for administrators.
    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<Category>>> GetAllForAdmin()
    {
        var categories = await _categoryRepository.GetAllAsync(
            includeInactive: true);

        return Ok(categories);
    }

    // GET: api/Categories/1
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<Category>> GetById(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Category ID must be positive."
            });
        }

        var category = await _categoryRepository.GetByIdAsync(id);

        if (category is null)
        {
            return NotFound(new
            {
                message = "Category not found."
            });
        }

        return Ok(category);
    }

    // POST: api/Categories
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Create(
        [FromBody] CategoryWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CategoryName))
        {
            return BadRequest(new
            {
                message = "Category name is required."
            });
        }

        var name = request.CategoryName.Trim();

        if (await _categoryRepository.CategoryNameExistsAsync(name))
        {
            return Conflict(new
            {
                message = "An active category with this name already exists."
            });
        }

        var normalizedRequest = new CategoryWriteRequest
        {
            CategoryName = name,
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim()
        };

        var id = await _categoryRepository.CreateAsync(normalizedRequest);

        var category =
            await _categoryRepository.GetByIdForAdminAsync(id);

        return CreatedAtAction(
            nameof(GetById),
            new { id },
            category);
    }

    // PUT: api/Categories/1
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] CategoryWriteRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Category ID must be positive."
            });
        }

        if (string.IsNullOrWhiteSpace(request.CategoryName))
        {
            return BadRequest(new
            {
                message = "Category name is required."
            });
        }

        var existingCategory =
            await _categoryRepository.GetByIdForAdminAsync(id);

        if (existingCategory is null)
        {
            return NotFound(new
            {
                message = "Category not found."
            });
        }

        var name = request.CategoryName.Trim();

        if (await _categoryRepository.CategoryNameExistsAsync(name, id))
        {
            return Conflict(new
            {
                message = "An active category with this name already exists."
            });
        }

        var normalizedRequest = new CategoryWriteRequest
        {
            CategoryName = name,
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim()
        };

        var updated = await _categoryRepository.UpdateAsync(
            id,
            normalizedRequest);

        if (!updated)
        {
            return NotFound(new
            {
                message = "Category not found."
            });
        }

        return NoContent();
    }

    // PATCH: api/Categories/1/activation
    // Body: { "isActive": true }
    [HttpPatch("{id:int}/activation")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetActivation(
        int id,
        [FromBody] ActivationRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Category ID must be positive."
            });
        }

        if (!request.IsActive.HasValue)
        {
            return BadRequest(new
            {
                message = "The isActive field is required."
            });
        }

        var category =
            await _categoryRepository.GetByIdForAdminAsync(id);

        if (category is null)
        {
            return NotFound(new
            {
                message = "Category not found."
            });
        }

        var isActive = request.IsActive.Value;

        if (isActive &&
            await _categoryRepository
                .CategoryNameExistsAsyncForActivation(id))
        {
            return Conflict(new
            {
                message =
                    "Another active category already uses this name."
            });
        }

        var updated = await _categoryRepository.SetActiveAsync(
            id,
            isActive);

        if (!updated)
        {
            return NotFound(new
            {
                message = "Category not found."
            });
        }

        return Ok(new
        {
            categoryId = id,
            isActive,
            message = isActive
                ? "Category activated successfully."
                : "Category deactivated successfully."
        });
    }

    // DELETE: api/Categories/1
    // Soft-deletes by setting IsActive = false.
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Category ID must be positive."
            });
        }

        var deleted = await _categoryRepository.DeactivateAsync(id);

        if (!deleted)
        {
            return NotFound(new
            {
                message = "Category not found."
            });
        }

        return NoContent();
    }
}
