
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class ProductVariantWriteRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Required]
    [StringLength(50, MinimumLength = 1)]
    public string SKU { get; set; } = string.Empty;

    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string Size { get; set; } = string.Empty;

    [Required]
    [StringLength(50, MinimumLength = 1)]
    public string Colour { get; set; } = string.Empty;

    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; }
}
