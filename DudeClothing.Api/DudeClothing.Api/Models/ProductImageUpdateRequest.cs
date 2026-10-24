using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class ProductImageUpdateRequest
{
    [Required]
    [StringLength(1000)]
    [Url]
    public string ImageUrl { get; set; } = string.Empty;

    [StringLength(250)]
    public string? AltText { get; set; }

    [Range(0, int.MaxValue)]
    public int SortOrder { get; set; }
}