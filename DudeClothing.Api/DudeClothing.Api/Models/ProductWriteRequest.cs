
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class ProductWriteRequest
{
    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }

    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string ProductName { get; set; } = string.Empty;

    [StringLength(4000)]
    public string? Description { get; set; }

    [Range(typeof(decimal), "0.01", "999999999")]
    public decimal Price { get; set; }

    [Url]
    [StringLength(1000)]
    public string? ImageUrl { get; set; }
}
