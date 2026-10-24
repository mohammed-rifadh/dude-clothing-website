
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class StockUpdateRequest
{
    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; }
}
