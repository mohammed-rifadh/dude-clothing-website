
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class CategoryWriteRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string CategoryName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }
}
