using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class ProductImageWriteRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Required]
    [StringLength(1000)]
    [Url]
    public string ImageUrl { get; set; } = string.Empty;

    [StringLength(250)]
    public string? AltText { get; set; }

    public bool IsPrimary { get; set; }

    [Range(0, int.MaxValue)]
    public int SortOrder { get; set; }
}